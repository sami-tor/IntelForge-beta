declare module 'adm-zip' {
  class AdmZip {
    constructor(filename?: string | Buffer);
    getEntries(): any[];
    getEntry(entryPath: string): any;
    readAsText(entry: any): string;
    extractAllTo(targetPath: string, overwrite?: boolean): void;
    addFile(filename: string, data: Buffer): void;
    writeZip(filename?: string): void;
  }
  export = AdmZip;
}








