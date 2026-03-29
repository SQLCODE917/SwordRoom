declare module 'dynalite' {
  export interface DynaliteOptions {
    path?: string;
    createTableMs?: number;
    deleteTableMs?: number;
  }

  export interface DynaliteServer {
    listen(port: number, host: string, callback: (error?: Error) => void): void;
    close(callback: () => void): void;
    address(): { port: number; address: string; family: string } | null;
  }

  export default function dynalite(options?: DynaliteOptions): DynaliteServer;
}
