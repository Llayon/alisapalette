import { preview } from 'vite';

/** Own the server in the test runner, including its portable shutdown. */
export default async function setup(config) {
  const baseURL = new URL(config.projects[0].use.baseURL);
  const server = await preview({
    preview: { host: baseURL.hostname, port: Number(baseURL.port), strictPort: true, open: false }
  });
  return async () => {
    server.httpServer.closeAllConnections?.();
    await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  };
}
