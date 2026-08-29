import type { PackageDependencyDescriptor } from "pm-utils";
import type { YarnProtocol } from "./yarnProtocol.ts";
export type YarnDescriptor = PackageDependencyDescriptor<YarnProtocol>;
export declare const parseYarnDescriptor: (descriptorString: string) => YarnDescriptor;
export declare const splitEntryKey: (entryKey: string) => string[];
//# sourceMappingURL=yarnDescriptor.d.ts.map