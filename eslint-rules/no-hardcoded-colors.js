/**
 * @fileoverview Disallow hardcoded Tailwind palette color classes in favor of semantic theme tokens.
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hardcoded Tailwind color classes. Use semantic theme tokens instead.",
    },
    schema: [],
    messages: {
      hardcodedColor:
        'Hardcoded color class "{{ className }}" found. ' +
        "Use semantic theme tokens instead: " +
        "bg-background, bg-card, bg-primary, bg-muted, bg-header, " +
        "text-foreground, text-muted-foreground, text-primary-foreground, " +
        "text-header-foreground, border-border, ring-ring.",
    },
  },
  create(context) {
    const BANNED_PATTERNS = [
      /\bbg-white\b/,
      /\bbg-black\b/,
      /\bbg-gray-\d+/,
      /\bbg-slate-\d+/,
      /\bbg-zinc-\d+/,
      /\bbg-neutral-\d+/,
      /\bbg-stone-\d+/,
      /\bbg-\[#[0-9a-fA-F]+\]/,
      /\btext-white\b/,
      /\btext-black\b/,
      /\btext-gray-\d+/,
      /\btext-slate-\d+/,
      /\btext-zinc-\d+/,
      /\btext-neutral-\d+/,
      /\btext-stone-\d+/,
      /\btext-\[#[0-9a-fA-F]+\]/,
      /\bborder-gray-\d+/,
      /\bborder-slate-\d+/,
      /\bborder-zinc-\d+/,
      /\bborder-neutral-\d+/,
      /\bborder-\[#[0-9a-fA-F]+\]/,
      /\bring-gray-\d+/,
      /\bring-slate-\d+/,
      /\bring-white\b/,
      /\bring-black\b/,
      /\bdivide-gray-\d+/,
      /\bdivide-slate-\d+/,
      /\bdivide-neutral-\d+/,
    ];

    const ALLOWED_EXCEPTIONS = [
      "bg-gray-200 animate-pulse",
      "bg-neutral-100 animate-pulse",
      "bg-black/50",
      "bg-black/60",
      "bg-black/70",
      "text-white",
    ];

    function checkClassName(node, className) {
      if (!className || typeof className !== "string") return;

      const classes = className.split(/\s+/);
      classes.forEach((cls) => {
        if (!cls) return;
        if (ALLOWED_EXCEPTIONS.some((ex) => className.includes(ex))) return;

        BANNED_PATTERNS.forEach((pattern) => {
          if (pattern.test(cls)) {
            context.report({
              node,
              messageId: "hardcodedColor",
              data: { className: cls },
            });
          }
        });
      });
    }

    /** Recursively pull class strings from cn/cva/clsx/twMerge arguments (including cva variant objects). */
    function scanArgument(reportNode, arg) {
      if (!arg) return;
      if (arg.type === "SpreadElement") {
        scanArgument(reportNode, arg.argument);
        return;
      }
      if (arg.type === "Literal" && typeof arg.value === "string") {
        checkClassName(reportNode, arg.value);
        return;
      }
      if (arg.type === "TemplateLiteral") {
        arg.quasis.forEach((q) => checkClassName(reportNode, q.value.raw));
        return;
      }
      if (arg.type === "LogicalExpression") {
        scanArgument(reportNode, arg.left);
        scanArgument(reportNode, arg.right);
        return;
      }
      if (arg.type === "ConditionalExpression") {
        scanArgument(reportNode, arg.consequent);
        scanArgument(reportNode, arg.alternate);
        return;
      }
      if (arg.type === "ObjectExpression") {
        for (const prop of arg.properties) {
          if (prop.type === "SpreadElement") {
            scanArgument(reportNode, prop.argument);
          } else if (prop.type === "Property") {
            scanArgument(reportNode, prop.value);
          }
        }
        return;
      }
      if (arg.type === "ArrayExpression") {
        for (const el of arg.elements) {
          if (el) scanArgument(reportNode, el);
        }
      }
    }

    function getCalleeName(callee) {
      if (!callee) return null;
      if (callee.type === "Identifier") return callee.name;
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier"
      ) {
        return callee.property.name;
      }
      return null;
    }

    return {
      CallExpression(node) {
        const name = getCalleeName(node.callee);
        if (!["cn", "cva", "clsx", "twMerge"].includes(name)) return;

        for (const arg of node.arguments) {
          scanArgument(node, arg);
        }
      },

      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "className")
          return;

        if (node.value?.type === "Literal") {
          checkClassName(node, node.value.value);
        }

        if (node.value?.type === "JSXExpressionContainer") {
          const expr = node.value.expression;
          if (expr.type === "TemplateLiteral") {
            expr.quasis.forEach((q) => checkClassName(node, q.value.raw));
          }
          if (expr.type === "Literal") {
            checkClassName(node, expr.value);
          }
        }
      },
    };
  },
};
