export function simpleLint(ast) {
    const issues = [];
    ast.blocks.forEach((block, index) => {
        if (block.words.length === 0) {
            issues.push({
                severity: "warning",
                message: "Block has no parseable words.",
                blockIndex: index
            });
        }
    });
    return issues;
}
//# sourceMappingURL=simpleLint.js.map