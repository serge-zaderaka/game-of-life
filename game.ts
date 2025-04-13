const CELL_STATES = ['#fff', '#acffaa'] as const; // white == dead, lime == alive
type CellState = typeof CELL_STATES[number];
const CELL_SIZE = 15;
const BORDER = { COLOR: '#ddd', WIDTH: 2 };
const NEIGHBOURS = [ // [[x,y]]
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], /*[0, 0],*/[1, 0],
  [-1, 1], [0, 1], [1, 1]
] as const;
const BREAKPOINTS = {
  OVERPOPULATION: 3,
  UNDERPOPULATION: 2,
  NEWBORN: 3
};
const FPS = 5;

class GameOfLife {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cols: number;
  private rows: number;
  private field: number[][];
  private isSetting: boolean = true;
  private timeOut: Timer;
  private frame: number;
  private isRunning: boolean = false;
  private abortController = new AbortController();
  private hasSignsOfLife: boolean = false;

  constructor(canvasId: string, cols: number, rows: number) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.cols = cols;
    this.rows = rows;
    this.canvas.width = this.cols * CELL_SIZE;
    this.canvas.height = this.rows * CELL_SIZE;

    this.init();
  }

  private generateField = () => {
    return Array.from(new Array(this.rows), (_, y) => new Proxy(new Array<number>(this.cols).fill(0), {
      set: (...args) => {
        const x = Number(args[1]);
        const updated = Reflect.set(...args);
        if (updated) this.drawCell(x * CELL_SIZE, y * CELL_SIZE, CELL_STATES[this.field[y][x]]);
        return updated;
      }
    }));
  }

  private drawCell = (x: number, y: number, cellState: CellState) => {
    this.ctx.fillStyle = cellState;
    this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    this.ctx.lineWidth = BORDER.WIDTH;
    this.ctx.strokeStyle = BORDER.COLOR;
    this.ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
  }

  private drawGrid = () => {
    this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = CELL_STATES[0]; // set all cells as dead on init
    this.ctx.fill();

    this.ctx.beginPath();
    for (let x = 0; x < this.canvas.width; x += CELL_SIZE) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
    }
    for (let y = 0; y < this.canvas.height; y += CELL_SIZE) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
    }
    this.ctx.lineWidth = BORDER.WIDTH;
    this.ctx.strokeStyle = BORDER.COLOR;
    this.ctx.stroke();
  }

  private getCellCoords = ({ offsetX, offsetY }: MouseEvent) => {
    return { x: Math.floor(offsetX / CELL_SIZE), y: Math.floor(offsetY / CELL_SIZE) };
  }

  private setMode = (e: MouseEvent) => {
    const { x, y } = this.getCellCoords(e);
    this.isSetting = !this.field[y]?.[x];
    this.setFirstGen(e);
  }

  private setFirstGen = (e: MouseEvent) => {
    if (
      e.buttons !== 1 ||
      e.offsetY < 0 ||
      e.offsetY >= this.canvas.height
    ) return;

    const { x, y } = this.getCellCoords(e);

    this.field[y][x] = +this.isSetting;
  }

  private getNeighboursCount = (Cx: number, Cy: number) => {
    let count = 0;
    for (let i = 0; i < NEIGHBOURS.length; i++) {
      if (count > BREAKPOINTS.OVERPOPULATION) break;
      const neighbour = NEIGHBOURS[i];

      let Nx = Cx + neighbour[0];
      let Ny = Cy + neighbour[1];

      if (Nx < 0) {
        Nx = this.cols - 1;
      } else if (Nx >= this.cols) {
        Nx = 0;
      }

      if (Ny < 0) {
        Ny = this.rows - 1;
      } else if (Ny >= this.rows) {
        Ny = 0;
      }

      count += this.field[Ny][Nx];
    }
    return count;
  }

  private getCellState = (x: number, y: number) => {
    const neighboursCount = this.getNeighboursCount(x, y);
    let isAlive = this.field[y][x];

    if (isAlive && (neighboursCount > BREAKPOINTS.OVERPOPULATION || neighboursCount < BREAKPOINTS.UNDERPOPULATION)) {
      isAlive = 0;
    } else if (!isAlive && neighboursCount === BREAKPOINTS.NEWBORN) {
      isAlive = 1;
    }

    return isAlive;
  }

  private updateField = () => {
    const cellsToChange: { x: number, y: number, state: number }[] = [];
    this.hasSignsOfLife = false;

    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        const nextCellState = this.getCellState(x, y);
        if (nextCellState !== this.field[y][x]) {
          cellsToChange.push({ x, y, state: nextCellState });
        }

        if (nextCellState && !this.hasSignsOfLife) {
          this.hasSignsOfLife = Boolean(nextCellState);
        }
      }
    }

    if (!cellsToChange.length) {
      this.isRunning = false;
      cancelAnimationFrame(this.frame);
      clearTimeout(this.timeOut);

      alert(`Our civilization has ${this.hasSignsOfLife ? 'reached harmony!' : 'perished :('}`);
      if (!this.hasSignsOfLife) this.reset();
    }

    for (let i = 0; i < cellsToChange.length; i++) {
      const c = cellsToChange[i];
      this.field[c.y][c.x] = c.state;
    }
  }

  private render = () => {
    if (!this.isRunning) return;
    this.updateField();
    this.timeOut = setTimeout(() => {
      this.frame = requestAnimationFrame(this.render);
    }, 1000 / FPS);
  }

  private init = () => {
    this.isRunning = false;
    if (this.abortController.signal.aborted) this.abortController = new AbortController();
    const signal = this.abortController.signal;
    this.canvas.addEventListener('mousemove', this.setFirstGen, { signal });
    this.canvas.addEventListener('mousedown', this.setMode, { signal });
    this.field = this.generateField();
    this.hasSignsOfLife = true;
    this.drawGrid();
  }

  public start = () => {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController.abort();
    this.render();
  }

  public reset = () => {
    clearTimeout(this.timeOut);
    cancelAnimationFrame(this.frame);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.init();
  }
}

const game = new GameOfLife('canvas', 100, 50);

document.getElementById('start')!.addEventListener('click', game.start);
document.getElementById('reset')!.addEventListener('click', game.reset);