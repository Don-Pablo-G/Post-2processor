import type { ProgramTemplate, TemplateLibrary } from "../types.js";
export declare function listProgramTemplates(): ProgramTemplate[];
export declare function exportTemplateLibrary(templates?: ProgramTemplate[]): TemplateLibrary;
export declare function importTemplateLibrary(sourceJson: string): TemplateLibrary;
