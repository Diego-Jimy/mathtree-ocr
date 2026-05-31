// Nodo basico del arbol de expresion.
export class TreeNode {
  constructor(value, left = null, right = null) {
    this.value = value;
    this.left = left;
    this.right = right;
    this.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    this.x = 0;
    this.y = 0;
    this.result = null;
  }

  get isOperator() {
    return ["+", "-", "*", "/"].includes(this.value);
  }
}

// Corrige simbolos frecuentes detectados por OCR.
export function cleanExpression(text) {
  return String(text || "")
    .replace(/[xX]/g, "*")
    .replace(/,/g, ".")
    .replace(/\u00f7/g, "/")
    .replace(/\u00d7/g, "*")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^0-9+\-*/().]/g, "");
}

function tokenize(expression) {
  const tokens = [];
  let i = 0;
  while (i < expression.length) {
    const char = expression[i];
    const previous = tokens[tokens.length - 1];
    const unaryMinus = char === "-" && (!previous || ["+", "-", "*", "/", "("].includes(previous));
    if (/\d|\./.test(char) || unaryMinus) {
      let value = unaryMinus ? "-" : "";
      i += unaryMinus ? 1 : 0;
      while (i < expression.length && /[\d.]/.test(expression[i])) value += expression[i++];
      if (value === "-" || Number.isNaN(Number(value))) throw new Error("Numero invalido.");
      tokens.push(value);
      continue;
    }
    if (["+", "-", "*", "/", "(", ")"].includes(char)) {
      tokens.push(char);
      i++;
      continue;
    }
    throw new Error("Caracter no permitido.");
  }
  return tokens;
}

// Construye el arbol respetando parentesis y prioridad.
export function parseExpression(expression) {
  const tokens = tokenize(cleanExpression(expression));
  let position = 0;

  function primary() {
    const token = tokens[position++];
    if (!token) throw new Error("La expresion esta incompleta.");
    if (token === "(") {
      const node = addSub();
      if (tokens[position++] !== ")") throw new Error("Falta cerrar un parentesis.");
      return node;
    }
    if (!Number.isNaN(Number(token))) return new TreeNode(token);
    throw new Error("Se esperaba un numero o parentesis.");
  }

  function mulDiv() {
    let node = primary();
    while (["*", "/"].includes(tokens[position])) {
      const operator = tokens[position++];
      node = new TreeNode(operator, node, primary());
    }
    return node;
  }

  function addSub() {
    let node = mulDiv();
    while (["+", "-"].includes(tokens[position])) {
      const operator = tokens[position++];
      node = new TreeNode(operator, node, mulDiv());
    }
    return node;
  }

  const root = addSub();
  if (position < tokens.length) throw new Error("Hay simbolos sobrantes.");
  return root;
}

// Evalua recursivamente y registra pasos para la animacion.
export function evaluateTree(node, steps = []) {
  if (!node.isOperator) {
    node.result = Number(node.value);
    return node.result;
  }
  const left = evaluateTree(node.left, steps);
  const right = evaluateTree(node.right, steps);
  if (node.value === "/" && right === 0) throw new Error("No se puede dividir entre cero.");
  const result = { "+": left + right, "-": left - right, "*": left * right, "/": left / right }[node.value];
  node.result = result;
  steps.push({ nodeId: node.id, leftId: node.left.id, rightId: node.right.id, result });
  return result;
}

function collectNodes(node, nodes = []) {
  if (!node) return nodes;
  collectNodes(node.left, nodes);
  nodes.push(node);
  collectNodes(node.right, nodes);
  return nodes;
}

// Calcula posiciones visuales para cada nodo.
export function layoutTree(root) {
  let order = 0;
  function walk(node, depth) {
    if (!node) return;
    walk(node.left, depth + 1);
    node.x = order * 138;
    node.y = depth * 148;
    order += 1;
    walk(node.right, depth + 1);
  }
  walk(root, 0);
  const nodes = collectNodes(root);
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  nodes.forEach((node) => {
    node.x -= (minX + maxX) / 2;
  });
}

export function formatResult(value) {
  const rounded = Number.parseFloat(Number(value).toFixed(6));
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}
