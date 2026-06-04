import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 계약서 템플릿/도장 파일을 서버리스 번들에 포함(런타임 fs.readFileSync)
  outputFileTracingIncludes: {
    "/sign/[token]": [
      "./src/lib/contracts/contract-template.html",
      "./src/lib/contracts/polarad-seal.png",
    ],
    "/api/contracts/[id]/html": [
      "./src/lib/contracts/contract-template.html",
      "./src/lib/contracts/polarad-seal.png",
    ],
  },
};

export default nextConfig;
