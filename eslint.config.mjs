import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The domain layer is the part that ports to React Native untouched, so it
    // must not reach for React, Next, Supabase or anything else outside itself.
    files: ["lib/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-dom",
                "react/*",
                "next",
                "next/*",
                "@supabase/*",
                "@/app/*",
                "@/components/*",
                "@/lib/data/*",
                "@/lib/design/*",
                "@/lib/utils",
                "../*",
              ],
              message:
                "lib/domain must stay framework-agnostic and dependency-free. Import only from within lib/domain.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
