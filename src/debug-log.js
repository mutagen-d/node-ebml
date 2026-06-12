export const debugLog = (name) => {
  let enabled = true
  const log = (...args) => {
    if (enabled) {
      console.log(`[${name}]`, ...args)
    }
  }
  log.enabled = enabled
  return log
}