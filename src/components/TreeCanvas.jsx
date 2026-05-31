import React, { useEffect, useRef } from "react";
import { formatResult } from "../lib/mathTree.js";

// Canvas interactivo con arrastre, rueda y zoom con dos dedos.
export default function TreeCanvas({ tree, steps, currentStep, answer }) {
  const canvasRef = useRef(null);
  const view = useRef({ scale: 1, x: 0, y: 0, dragging: false, sx: 0, sy: 0, ox: 0, oy: 0, pinchDistance: 0, pinchScale: 1 });
  const pointers = useRef(new Map());

  function distance() {
    const values = [...pointers.current.values()];
    return values.length < 2 ? 0 : Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(rect.width / 2 + view.current.x, 105 + view.current.y);
    ctx.scale(view.current.scale, view.current.scale);

    const active = steps[currentStep - 1];
    const activeIds = active ? new Set([active.nodeId, active.leftId, active.rightId]) : new Set();
    const doneIds = new Set(steps.slice(0, currentStep).map((step) => step.nodeId));

    function lines(node) {
      if (!node) return;
      [node.left, node.right].forEach((child) => {
        if (!child) return;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y + 39);
        ctx.lineTo(child.x, child.y - 39);
        ctx.strokeStyle = "#9aaac0";
        ctx.lineWidth = 5;
        ctx.stroke();
        lines(child);
      });
    }

    function nodes(node) {
      if (!node) return;
      nodes(node.left);
      const activeNode = activeIds.has(node.id);
      const done = doneIds.has(node.id);
      ctx.beginPath();
      ctx.arc(node.x, node.y, activeNode ? 45 : 39, 0, Math.PI * 2);
      ctx.fillStyle = node.isOperator ? "#172033" : "#ffffff";
      ctx.fill();
      ctx.lineWidth = activeNode ? 7 : 4;
      ctx.strokeStyle = activeNode ? "#22c55e" : done ? "#16a34a" : node.isOperator ? "#ff9800" : "#4fc3f7";
      ctx.stroke();
      ctx.fillStyle = node.isOperator ? "#ffb74d" : "#0369a1";
      ctx.font = "800 22px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.value, node.x, node.y);
      if ((activeNode || done) && node.result !== null) {
        ctx.fillStyle = done ? "#15803d" : "#b45309";
        ctx.font = "800 13px Inter, sans-serif";
        ctx.fillText(`= ${formatResult(node.result)}`, node.x, node.y + 60);
      }
      nodes(node.right);
    }

    lines(tree);
    nodes(tree);
    ctx.restore();
  }

  useEffect(() => {
    draw();
    const resize = () => draw();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [tree, steps, currentStep, answer]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full min-h-[580px] w-full touch-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 2) {
          view.current.pinchDistance = distance();
          view.current.pinchScale = view.current.scale;
          return;
        }
        Object.assign(view.current, { dragging: true, sx: event.clientX, sy: event.clientY, ox: view.current.x, oy: view.current.y });
      }}
      onPointerMove={(event) => {
        if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 2) {
          const startDistance = Math.max(view.current.pinchDistance, 1);
          view.current.scale = Math.max(0.45, Math.min(2.8, view.current.pinchScale * (distance() / startDistance)));
          draw();
          return;
        }
        if (!view.current.dragging) return;
        view.current.x = view.current.ox + event.clientX - view.current.sx;
        view.current.y = view.current.oy + event.clientY - view.current.sy;
        draw();
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        view.current.dragging = false;
      }}
      onWheel={(event) => {
        event.preventDefault();
        view.current.scale = Math.max(0.45, Math.min(2.8, view.current.scale * (event.deltaY > 0 ? 0.92 : 1.08)));
        draw();
      }}
    />
  );
}
