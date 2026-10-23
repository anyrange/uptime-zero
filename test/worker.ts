// Worker entry for the Workers test pool. Void builds the deployed Worker from
// the Start app, so tests call the server modules directly instead.
export default {
  fetch: () => new Response(null, { status: 404 }),
} satisfies ExportedHandler<Env>;
