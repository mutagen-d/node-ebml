// @flow


/**
 * @typedef {{
 *  data: Buffer,
 *  dataSize: number,
 *  discardable: boolean,
 *  end: number,
 *  id: number,
 *  keyframe: boolean,
 *  payload: Buffer,
 *  start: number,
 *  tagStr: string,
 *  track: number,
 *  value: number | string,
 * }} TagMeta
 */

/** @typedef {import('./schema.types').EBMLSchema & TagMeta} Tag */

/** @typedef {Tag & { children: TagStackItem[] }} TagStackItem */
/** @typedef {TagStackItem[]} TagStack */

module.exports = {}