const debugLog = (name) => {
  let enabled = false
  const log = (...args) => {
    if (enabled) {
      console.log(`[${name}]`, ...args)
    }
  }
  log.enabled = enabled
  return log
}

module.exports = { debugLog }
