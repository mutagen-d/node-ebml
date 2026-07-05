const { Transform } = require('stream');
const tools = require('./tools');
const schema = require('./schema');
const { debugLog } = require('./debug-log');

const debug = debugLog('ebml:decoder');

const STATE = Object.freeze({
  TAG: 1,
  SIZE: 2,
  CONTENT: 3,
})

class EbmlDecoder extends Transform {
  /**
   * @constructor
   * @param {{ isLive?: boolean }} options The options to be passed along to the super class
   */
  constructor(options = {}) {
    super({ ...options, readableObjectMode: true });
    /**
     * @protected
     * @type {undefined|Buffer}
     */
    this.buffer

    /**
     * @protected
     * @type {import('./schema').EBMLHead[]>}
     */
    this.stack = []

    /** @protected */
    this.cursor = 0
    /** @protected */
    this.total = 0
    /** @protected */
    this.state = STATE.TAG
  }

  _transform(chunk, enc, done) {
    this.buffer = this.buffer
      ? tools.concat(this.buffer, Buffer.from(chunk))
      : Buffer.from(chunk)

    while (this.cursor < this.buffer.length) {
      if (this.state === STATE.TAG && !this.readTag()) {
        break;
      }
      if (this.state === STATE.SIZE && !this.readSize()) {
        break;
      }
      if (this.state === STATE.CONTENT && !this.readContent()) {
        break;
      }
    }

    done();
  }

  /**
   * @param {number} id
   */
  static getSchemaInfo(id) {
    if (Number.isInteger(id) && schema.has(id)) {
      return schema.get(id);
    }
    const hex = `0x${id.toString(16).toUpperCase()}`
    const unknown = {
      type: null,
      name: `unknown-${hex}`,
      description: `${hex}`,
      level: -1,
      minver: -1,
      multiple: false,
      webm: false,
    };
    schema.set(id, unknown)
    console.warn('[SCHEMA]', 'unknown tag:', hex)
    return unknown
  }

  readTag() {
    if (debug.enabled) {
      debug('parsing tag');
    }

    if (this.cursor >= this.buffer.length) {
      if (debug.enabled) {
        debug('waiting for more data');
      }
      return false;
    }

    const start = this.total;
    const tag = tools.readVint(this.buffer, this.cursor);

    if (tag == null) {
      if (debug.enabled) {
        debug('waiting for more data');
      }

      return false;
    }

    const tagNum = this.buffer.readUintBE(this.cursor, tag.length)
    this.cursor += tag.length;
    this.total += tag.length;
    this.state = STATE.SIZE;

    const info = EbmlDecoder.getSchemaInfo(tagNum)
    /** @type {import('./schema').EBMLTag['head']} */
    const head = {
      id: tagNum,
      size: undefined,
      name: info.name,
      type: info.type,
      level: info.level,
      _start: start,
      _end: start + tag.length,
    }

    this.stack.push(head);
    if (debug.enabled) {
      debug(`read tag: ${head.name}`);
    }

    return true;
  }

  readSize() {
    const head = this.stack[this.stack.length - 1];

    if (debug.enabled) {
      debug(`parsing size for tag: ${head.name}`);
    }

    if (this.cursor >= this.buffer.length) {
      if (debug.enabled) {
        debug('waiting for more data');
      }

      return false;
    }

    const size = tools.readVint(this.buffer, this.cursor);

    if (size == null) {
      if (debug.enabled) {
        debug('waiting for more data');
      }

      return false;
    }

    this.cursor += size.length;
    this.total += size.length;
    this.state = STATE.CONTENT;
    head.size = size.value;
    if (size.value === -1) {
      head._end = -1;
    } else {
      head._end += size.value + size.length;
    }
    if (debug.enabled) {
      debug(`read size(${head.name}): ${size.value}`);
    }

    return true;
  }

  readContent() {
    const head = this.stack[this.stack.length - 1];

    if (debug.enabled) {
      debug(`parsing content for tag: ${head.name}`);
    }

    if (head.type === 'm') {
      if (debug.enabled) {
        debug('content should be tags');
      }
      this.push(['start', { head }])
      if (head.size === 0 || head.size === -1) {
        this.stack.pop()
        this.push(['end', { head }])
      }
      this.state = STATE.TAG;

      return true;
    }

    if (this.buffer.length < this.cursor + head.size) {
      if (debug.enabled) {
        debug(`got: ${this.buffer.length}`);
        debug(`need: ${this.cursor + head.size}`);
        debug('waiting for more data');
      }

      return false;
    }

    const data = this.buffer.subarray(this.cursor, this.cursor + head.size);
    this.total += head.size;

    this.state = STATE.TAG;
    this.buffer = this.buffer.subarray(this.cursor + head.size);
    this.cursor = 0;

    this.stack.pop();
    this.push(['tag', tools.readBody(head, Buffer.from(data))]);

    while (this.stack.length > 0) {
      const head = this.stack[this.stack.length - 1];
      if (this.total < head._end) {
        break;
      }
      this.stack.pop();
      this.push(['end', { head }]);
    }

    if (debug.enabled) {
      debug(`read data: ${data.toString('hex').slice(0, 100)}`);
    }

    return true;
  }
}

module.exports = EbmlDecoder
