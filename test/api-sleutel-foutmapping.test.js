const test = require('node:test')
const assert = require('node:assert/strict')
const { bepaalFoutmelding } = require('../js/api-sleutel-foutmapping.js')

test('accessNotConfigured -> melding om terug te gaan naar stap 1', () => {
  const result = bepaalFoutmelding({ status: 403, json: { error: { errors: [{ reason: 'accessNotConfigured' }] } } })
  assert.equal(result, 'apiSleutelDialoog.foutAccessNotConfigured')
})

test('keyInvalid -> ongeldige-sleutel-melding', () => {
  const result = bepaalFoutmelding({ status: 400, json: { error: { errors: [{ reason: 'keyInvalid' }] } } })
  assert.equal(result, 'apiSleutelDialoog.foutKeyInvalid')
})

test('badRequest -> ongeldige-sleutel-melding', () => {
  const result = bepaalFoutmelding({ status: 400, json: { error: { errors: [{ reason: 'badRequest' }] } } })
  assert.equal(result, 'apiSleutelDialoog.foutKeyInvalid')
})

test('quotaExceeded -> quotummelding', () => {
  const result = bepaalFoutmelding({ status: 403, json: { error: { errors: [{ reason: 'quotaExceeded' }] } } })
  assert.equal(result, 'apiSleutelDialoog.foutQuota')
})

test('dailyLimitExceeded -> quotummelding', () => {
  const result = bepaalFoutmelding({ status: 403, json: { error: { errors: [{ reason: 'dailyLimitExceeded' }] } } })
  assert.equal(result, 'apiSleutelDialoog.foutQuota')
})

test('onbekende reason -> generieke melding', () => {
  const result = bepaalFoutmelding({ status: 500, json: { error: { errors: [{ reason: 'internalError' }] } } })
  assert.equal(result, 'apiSleutelDialoog.foutOnbekend')
})

test('error zonder errors-array -> generieke melding', () => {
  const result = bepaalFoutmelding({ status: 400, json: { error: { code: 400, message: 'Bad Request' } } })
  assert.equal(result, 'apiSleutelDialoog.foutOnbekend')
})

test('netwerkfout (geen response) -> generieke melding', () => {
  const result = bepaalFoutmelding({ netwerkfout: true })
  assert.equal(result, 'apiSleutelDialoog.foutOnbekend')
})

test('succesvolle response zonder error -> geen foutmelding', () => {
  const result = bepaalFoutmelding({ status: 200, json: { items: [{ id: 'jNQXAC9IVRw' }] } })
  assert.equal(result, null)
})
