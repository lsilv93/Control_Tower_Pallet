/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["exceljs", "bwip-js", "pdfkit"],
  // pdfkit lê as métricas das fontes padrão do disco: inclui os arquivos no deploy (Vercel).
  outputFileTracingIncludes: {
    "/api/vales/[id]/pdf": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/auditoria/exportar": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
