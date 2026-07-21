function bepaalFoutmelding({ status, json, netwerkfout } = {}) {
  if (netwerkfout || !json) return 'apiSleutelDialoog.foutOnbekend'
  if (!json.error) return null

  const reasons = (json.error.errors || []).map(e => e.reason)

  if (reasons.includes('accessNotConfigured')) return 'apiSleutelDialoog.foutAccessNotConfigured'
  if (reasons.includes('keyInvalid') || reasons.includes('badRequest')) return 'apiSleutelDialoog.foutKeyInvalid'
  if (reasons.includes('quotaExceeded') || reasons.includes('dailyLimitExceeded')) return 'apiSleutelDialoog.foutQuota'
  return 'apiSleutelDialoog.foutOnbekend'
}

if (typeof window !== 'undefined') window.bepaalFoutmelding = bepaalFoutmelding
if (typeof module !== 'undefined') module.exports = { bepaalFoutmelding }
