function validateHaasNgc(ast) {
    const issues = [];
    ast.blocks.forEach((block, index) => {
        if (block.raw.includes("M30") && index !== ast.blocks.length - 1) {
            issues.push({
                severity: "warning",
                message: "M30 appears before the last block.",
                blockIndex: index
            });
        }
    });
    return issues;
}
export const haasNgcProfile = {
    id: "haas-ngc",
    name: "Haas NGC",
    defaultFormatStyle: {
        upperCaseWords: true,
        normalizeSpacing: true,
        removeStandaloneOptionalStops: false
    },
    validateAst: validateHaasNgc
};
//# sourceMappingURL=profile.js.map