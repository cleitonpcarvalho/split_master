import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, env.host, () => {
  console.log(
    `API Split Master disponível em http://${env.host}:${env.port}`,
  );
});

function shutdown(signal: string): void {
  console.log(`${signal} recebido. Encerrando servidor...`);

  server.close((error) => {
    if (error) {
      console.error("Falha ao encerrar o servidor:", error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Promise rejeitada sem tratamento:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Exceção não capturada:", error);
  process.exit(1);
});
