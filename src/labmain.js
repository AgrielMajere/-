import { openLab } from './lab.js';
export function open(el){ return openLab(el || document.getElementById('lab')); }
