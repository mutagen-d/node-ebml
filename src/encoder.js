const { Transform } = require('stream');
const schema = require('./schema');
const tools = require('./tools');
const { debugLog } = require('./debug-log');

const debug = debugLog('ebml:encoder');

/** @typedef {import('./schema').EBMLTag} Tag */

/**
 * @param {import('./schema').EBMLHead} head
 * @param {Buffer} buffer
 */
function encodeTag(head, buffer) {
  if (!head) {
    return Buffer.alloc(0)
  }
  const id = Buffer.from(head.id.toString(16), 'hex');
  const size = head.size === -1
    ? Buffer.from([0xFF])
    : tools.writeVint(buffer.byteLength);
  // cast ArrayBuffer to Buffer
  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer);
  }
  return Buffer.concat([id, size, buffer]);
}

/**
 * Encodes a raw EBML stream
 */
class EbmlEncoder extends Transform {
  constructor(options = {}) {
    super({ ...options, writableObjectMode: true });
    /**
     * @private
     * @type {Buffer}
     */
    this.buffer
    /**
     * @private
     * @type {import('./schema').EBMLTagItem[]}
     */
    this.stack = []
    /** @private */
    this.corked = false
  }

  /**
   *
   * @param {[string, import('./schema').EBMLTag]} chunk array of chunk data, starting with the tag
   * @param {string} enc the encoding type (not used)
   * @param {() => any} done a callback method to call after the transformation
   */
  _transform(chunk, enc, done) {
    const [action, tag] = chunk;
    if (debug.enabled) {
      debug(`encode ${action} ${tag.head.name}`);
    }

    switch (action) {
      case 'start':
        this.startTag(tag);
        break;
      case 'tag':
        this.writeTag(tag);
        break;
      case 'end':
        this.endTag();
        break;
      default:
        break;
    }

    return done();
  }

  /**
   * @private
   * @param {Function} done callback function
   */
  flush(done = () => {}) {
    if (!this.buffer || this.corked) {
      if (debug.enabled) {
        debug('no buffer/nothing pending');
      }
      return done();
    }

    if (this.buffer.byteLength === 0) {
      if (debug.enabled) {
        debug('empty buffer');
      }
      return done();
    }

    if (debug.enabled) {
      debug(`writing ${this.buffer.length} bytes`);
    }

    const chunk = Buffer.from(this.buffer);
    this.buffer = null;
    this.push(chunk);
    return done();
  }

  /**
   * @private
   * @param {Buffer | Buffer[]} buffer
   */
  bufferAndFlush(buffer) {
    this.buffer = tools.concat(this.buffer, buffer);
    this.flush();
  }

  _flush(done = () => {}) {
    this.flush(done);
  }

  _bufferAndFlush(buffer) {
    this.bufferAndFlush(buffer);
  }

  /**
   * gets the ID of the type of tagName
   * @static
   * @param  {string} tagName to be looked up
   * @return {number}         A buffer containing the schema information
   */
  static getSchemaID(tagName) {
    const tagId = Array.from(schema.keys()).find(
      str => schema.get(str).name === tagName,
    );
    if (tagId) {
      return tagId;
    }

    return null;
  }

  cork() {
    this.corked = true;
  }

  uncork() {
    this.corked = false;
    this.flush();
  }

  /** 
   * @private
   * @param {import('./schema').EBMLTag} tag
   */
  writeTag(tag) {
    const tagId = tag.head.id;
    if (!tagId) {
      throw new Error(`No schema entry found for ${tag.head.name}`);
    }
    if (tag.body.buffer) {
      const data = encodeTag(tag.head, tag.body.buffer);
      if (this.stack.length > 0) {
        this.stack[this.stack.length - 1].children.push({ buffer: data });
      } else {
        this.bufferAndFlush(data);
      }
    }
  }

  /**
   * @private
   * @param {import('./schema').EBMLTag} tag
   */
  startTag(tag) {
    if (!tag.head.id) {
      throw new Error(`No schema entry found for ${tag.head.name}`);
    }

    /** @type {import('./schema').EBMLTagItem} */
    const tagItem = {
      head: tag.head,
      buffer: Buffer.alloc(0),
      children: [],
    };

    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].children.push(tagItem);
    }
    this.stack.push(tagItem);
  }

  /** @private */
  endTag() {
    const tag = this.stack.pop();
    if (!tag) {
      return;
    }
    const childBuffers = tag.children.map(child => child.buffer);
    tag.buffer = encodeTag(tag.head, Buffer.concat(childBuffers))
    if (!this.stack.length) {
      this.bufferAndFlush(tag.buffer);
    }
  }
}

module.exports = EbmlEncoder
