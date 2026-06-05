const schema = require("./schema");

class Tools {
  /**
   * read variable length integer per
   * https://www.matroska.org/technical/specs/index.html#EBML_ex
   * @static
   * @param {Buffer} buffer containing input
   * @param {Number} [start=0] position in buffer
   * @returns {{length: Number, value: number}}  value / length object
   */
  static readVint(buffer, start = 0) {
    // Calculate length based on leading zeros in the first byte
    const firstByte = buffer[start];

    // Find the first 1 bit to determine length (VINT_WIDTH)
    let length = 1;
    let mask = 0x80; // 10000000 binary
    while ((firstByte & mask) === 0 && length <= 8) {
      length++;
      mask >>= 1;
    }

    if (length > 8) {
      const number = Tools.readHexString(buffer, start, start + length);
      throw new Error(`Unrepresentable length: ${length} ${number}`);
    }

    if (start + length > buffer.length) {
      return null;
    }

    // Check if all data bits are 1 (indicating unknown/infinite size)
    const dataMask = (1 << (8 - length)) - 1;
    let value = firstByte & dataMask;

    // Check for "all bits set" pattern (unknown size)
    let allBitsSet = (firstByte & dataMask) === dataMask;
    for (let i = 1; i < length && allBitsSet; i++) {
      if (buffer[start + i] !== 0xFF) {
        allBitsSet = false;
      }
    }

    // If all data bits are 1, it represents unknown/infinite size
    if (allBitsSet) {
      return { length, value: -1 };
    }

    // Parse the remaining bytes
    for (let i = 1; i < length; i++) {
      value = (value << 8) | buffer[start + i];
    }

    return { length, value };
  }

  /**
   * write variable length integer
   * @static
   * @param {Number} value to store into buffer
   * @returns {Buffer} containing the value
   */
  static writeVint(value, minLength = 1) {
    if (value < 0 || value > 2 ** 53) {
      throw new Error(`Unrepresentable value: ${value}`);
    }

    minLength = typeof minLength === 'number' && !isNaN(minLength) ? Math.max(1, minLength) : 1;
    minLength = Math.min(8, minLength);
    let length = 1;
    for (length = minLength; length <= 8; length += 1) {
      if (value < 2 ** (7 * length) - 1) {
        break;
      }
    }

    const buffer = Buffer.alloc(length);
    let val = value;
    for (let i = 1; i <= length; i += 1) {
      const b = val & 0xff;
      buffer[length - i] = b;
      val -= b;
      val /= 2 ** 8;
    }
    buffer[0] |= 1 << (8 - length);

    return buffer;
  }

  /**
   * *
   * concatenate two arrays of bytes
   * @static
   * @param {Buffer} a1  First array
   * @param {Buffer} a2  Second array
   * @returns  {Buffer} concatenated arrays
   */
  static concatenate(a1, a2) {
    // both null or undefined
    if (!a1 && !a2) {
      return Buffer.from([]);
    }
    if (!a1 || a1.byteLength === 0) {
      return a2;
    }
    if (!a2 || a2.byteLength === 0) {
      return a1;
    }

    return Buffer.concat([a1, a2]);
  }

  /**
   * get a hex text string from Buff[start,end)
   * @param {Buffer} buff from which to read the string
   * @param {Number} [start=0] starting point (default 0)
   * @param {Number} [end=buff.byteLength] ending point (default the whole buffer)
   * @returns {string} the hex string
   */
  static readHexString(buff, start = 0, end = buff.byteLength) {
    return Array.from(buff.slice(start, end))
      .map(q => Number(q).toString(16))
      .reduce((acc, current) => `${acc}${current.padStart(2, '0')}`, '');
  }

  /**
   * tries to read out a UTF-8 encoded string
   * @param  {Buffer} buff the buffer to attempt to read from
   * @return {string|null}      the decoded text, or null if unable to
   */
  static readUtf8(buff) {
    try {
      return Buffer.from(buff).toString('utf8');
    } catch (exception) {
      return null;
    }
  }

  /**
   * get an unsigned number from a buffer
   * @param {Buffer} buff from which to read variable-length unsigned number
   * @returns {number|string} result (in hex for lengths > 6)
   */
  static readUnsigned(buff) {
    const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength);
    switch (buff.byteLength) {
      case 1:
        return b.getUint8(0);
      case 2:
        return b.getUint16(0);
      case 4:
        return b.getUint32(0);
      default:
        break;
    }
    if (buff.byteLength <= 6) {
      return buff.reduce((acc, current) => acc * 256 + current, 0);
    }

    return Tools.readHexString(buff, 0, buff.byteLength);
  }

  /**
   * get an signed number from a buffer
   * @static
   * @param {Buffer} buff from which to read variable-length signed number
   * @returns {number} result
   */
  static readSigned(buff) {
    const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength);
    switch (buff.byteLength) {
      case 1:
        return b.getInt8(0);
      case 2:
        return b.getInt16(0);
      case 4:
        return b.getInt32(0);
      default:
        return NaN;
    }
  }

  /**
   * get an floating-point number from a buffer
   * @static
   * @param {Buffer} buff from which to read variable-length floating-point number
   * @returns {number} result
   */
  static readFloat(buff) {
    const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength);
    switch (buff.byteLength) {
      case 4:
        return b.getFloat32(0);
      case 8:
        return b.getFloat64(0);
      default:
        return NaN;
    }
  }

  /**
   * get a date from a buffer
   * @static
   * @param  {Buffer} buff from which to read the date
   * @return {Date}      result
   */
  static readDate(buff) {
    const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength);
    switch (buff.byteLength) {
      case 1:
        return new Date(b.getUint8(0));
      case 2:
        return new Date(b.getUint16(0));
      case 4:
        return new Date(b.getUint32(0));
      case 8:
        return new Date(Number.parseInt(Tools.readHexString(buff), 16));
      default:
        return new Date(0);
    }
  }

  /**
   * Reads the data from a tag
   * @static
   * @param  {TagData} tagObj The tag object to be read
   * @param  {Buffer} data Data to be transformed
   * @return {Tag} result
   */
  static readDataFromTag(tagObj, data) {
    const { type, name } = tagObj;
    let { track } = tagObj;
    let discardable = tagObj.discardable || false;
    let keyframe = tagObj.keyframe || false;
    let payload = null;
    let value;

    switch (type) {
      case 'u':
        value = Tools.readUnsigned(data);
        break;
      case 'f':
        value = Tools.readFloat(data);
        break;
      case 'i':
        value = Tools.readSigned(data);
        break;
      case 's':
        value = String.fromCharCode(...data);
        break;
      case '8':
        value = Tools.readUtf8(data);
        break;
      case 'd':
        value = Tools.readDate(data);
        break;
      default:
        break;
    }

    if (name === 'SimpleBlock' || name === 'Block') {
      let p = 0;
      const { length, value: trak } = Tools.readVint(data, p);
      p += length;
      track = trak;
      value = Tools.readSigned(data.subarray(p, p + 2));
      p += 2;
      if (name === 'SimpleBlock') {
        keyframe = Boolean(data[length + 2] & 0x80);
        discardable = Boolean(data[length + 2] & 0x01);
      }
      p += 1;
      payload = data.subarray(p);
    }

    return {
      ...tagObj,
      data,
      discardable,
      keyframe,
      payload,
      track,
      value,
    };
  }

  /**
   * @param {Array<[number, import("./types/schema.types").EBMLSchema]>} items
   */
  static addSchema(items) {
    if (!Array.isArray(items)) {
      return schema
    }
    for (const item of items) {
      schema.set(item[0], item[1])
    }
    return schema
  }

  /**
   * @param {number} value
   * @param {number} size
   */
  static toUint8(value, size) {
    var buf = new Uint8Array(size)
    for (let i = 0, k = size - 1; i < size; ++i, --k) {
      buf[i] = (value >> (8 * k)) & 0xFF
    }
    return buf
  }

  /** @param {number} value */
  static measureUnsignedInt(value) {
    // Force to 32-bit unsigned integer
    if (value < (1 << 8)) {
      return 1;
    } else if (value < (1 << 16)) {
      return 2;
    } else if (value < (1 << 24)) {
      return 3;
    } else if (value < 2 ** 32) {
      return 4;
    } else if (value < 2 ** 40) {
      return 5;
    } else {
      return 6;
    }
  };

  /** @param {number} value */
  static measureEBMLVarInt(value) {
    if (value < (1 << 7) - 1) {
      /** Top bit is set, leaving 7 bits to hold the integer, but we can't store
       * 127 because "all bits set to one" is a reserved value. Same thing for the
       * other cases below:
       */
      return 1;
    } else if (value < (1 << 14) - 1) {
      return 2;
    } else if (value < (1 << 21) - 1) {
      return 3;
    } else if (value < (1 << 28) - 1) {
      return 4;
    } else if (value < 2 ** 35 - 1) {
      return 5;
    } else if (value < 2 ** 42 - 1) {
      return 6;
    } else {
      throw new Error('EBML VINT size not supported ' + value);
    }
  };
}

module.exports = Tools