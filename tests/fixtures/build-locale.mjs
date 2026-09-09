// Reproduce a host-default locale without depending on the runner's OS language.
const compare = String.prototype.localeCompare
String.prototype.localeCompare = function (other, locale, options) {
  return compare.call(this, other, locale ?? process.env.WORLD_TEST_LOCALE, options)
}
