// Placeholder for Deno global to silence IDE errors in non-Deno environments
declare const Deno: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => void;
    env: {
        get: (key: string) => string | undefined;
        toObject: () => { [key: string]: string };
    };
};

// Module declaration to solve import "std/crypto" error
declare module "std/crypto" {
    export const crypto: {
        subtle: {
            digest: (algorithm: string, data: ArrayBufferLike) => Promise<ArrayBuffer>;
        };
    };
}
