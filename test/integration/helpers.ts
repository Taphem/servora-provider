export function isInfraAvailable(): boolean {
  return Boolean(process.env['TEST_DATABASE_URL']);
}
