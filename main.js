const DEFAULT_COLOR = "gray";
const SET_COLOR = "blue";
const OPEN_COLOR = "yellow";
const CLOSED_COLOR = "green";

const POINT_DEFAULT_COLOR = "white";
const POINT_CONVEX_CORNER_COLOR = "aqua";
const POINT_COLINEAR_COLOR = "yellow";
const POINT_CONCAVE_CORNER_COLOR = "purple";
const POINT_INSIDE_COLOR = "beige";

function Grid(width, height) {
	this.width = width;
	this.height = height;
	this.createCells();
	this.createPoints();
	this.resize();
	this.load();
}

Grid.prototype.createCells = function () {
	this.cells = [];
	for (let x = 0; x < this.width; x++) {
		const column = [];
		for (let y = 0; y < this.height; y++) {
			column.push(new Cell(this, x, y));
		}
		this.cells.push(column);
	}
};

Grid.prototype.createPoints = function () {
	this.points = [];
	for (let x = 0; x < this.width + 1; x++) {
		const column = [];
		for (let y = 0; y < this.height + 1; y++) {
			column.push(new Point(this, x, y));
		}
		this.points.push(column);
	}
};

Grid.prototype.resize = function () {
	const screenSize = Math.min(window.innerWidth, window.innerHeight) * 0.5;
	const gridSize = Math.min(this.width, this.height);
	
	this.cellFullSize = Math.max(Math.trunc(screenSize / gridSize), 2);
	this.cellPadding = Math.ceil(this.cellFullSize * 0.05);
	this.cellSize = this.cellFullSize - this.cellPadding;
	
	for (let x = 0; x < this.width; x++)
		for (let y = 0; y < this.height; y++)
			this.cells[x][y].resize();
		
	for (let x = 0; x < this.width + 1; x++)
		for (let y = 0; y < this.height + 1; y++)
			this.points[x][y].resize();
};

Grid.prototype.reset = function () {
	for (let x = 0; x < this.width; x++)
		for (let y = 0; y < this.height; y++)
			this.cells[x][y].reset();
		
	for (let x = 0; x < this.width + 1; x++)
		for (let y = 0; y < this.height + 1; y++)
			this.points[x][y].reset();
};

Grid.prototype.activate = function (cell) {
	cell.setSet(!cell.isSet);
	this.save();
	this.generateHull();
};

Grid.prototype.startHullGeneration = function (cell) {
	this.hullStartCell = cell;
	this.save();
	this.generateHull();
};

Grid.prototype.generateHull = function () {
	
	this.reset();
	
	let openCells = [];
	
	const openCell = function (cell) {
		cell.open();
		openCells.push(cell);
	};
	
	openCell(this.hullStartCell);
	
	while (openCells.length > 0) {
		const cell = openCells.shift();
		cell.close();
		
		this.tryStartHullGeneration(cell);
		
		let n_offset = {x: -1, y: 0};
		for (let n = 0; n < 4; n++) {
			const n_cell = this.getCell(cell.x + n_offset.x, cell.y + n_offset.y);
			if (n_cell && n_cell.isSet && !n_cell.isOpen)			
				openCell(n_cell);
			n_offset = {x: n_offset.y, y: -n_offset.x};
		}
	}
};

Grid.prototype.calcPointWeight = function (point) {
	if (point.weight !== undefined)
		return;
	
	const OFFSETS = [{x:-1,y:-1},{x:0,y:0},{x:-1,y:0},{x:0,y:-1}];
	const gridWeight = [];
	
	point.weight = 0;
	
	for (let i = 0; i < OFFSETS.length; i++) {
		const offset = OFFSETS[i];
		const cell = this.getCell(point.x + offset.x, point.y + offset.y);
		const weight = cell && cell.isSet ? 1 : 0;
		gridWeight.push(weight);
		point.weight += weight;
	}
	
	point.isDiagonalCase = point.weight === 2 && gridWeight[0] === gridWeight[1];
	
	if (point.isDiagonalCase) {
		point = point;
		point.updateColor();
		point = point;
	}
	
	point.updateColor();
};

Grid.prototype.tryStartHullGeneration = function (cell) {
	const point = this.points[cell.x][cell.y];
	this.calcPointWeight(point);
};

Grid.prototype.getCell = function (x, y) {
	if (x < 0 || y < 0 || x >= this.width || y >= this.height) 
		return null;
	return this.cells[x][y];
};

Grid.prototype.load = function () {
	const serializedGrid = localStorage.getItem("grid");
	if (serializedGrid.length === this.width * this.height) {
		let index = 0;
		for (let x = 0; x < this.width; x++)
			for (let y = 0; y < this.height; y++)
				this.cells[x][y].setSet(serializedGrid[index++] === "1");
	}
		
	const hullStart = JSON.parse(localStorage.getItem("hullStart"));
	if (hullStart) {
		this.hullStartCell = this.cells[hullStart.x][hullStart.y];
		this.generateHull();
	}
};

Grid.prototype.save = function () {
	let serializedGrid = "";
	for (let x = 0; x < this.width; x++)
		for (let y = 0; y < this.height; y++)
			serializedGrid += this.cells[x][y].isSet ? "1" : "0";
	localStorage.setItem("grid", serializedGrid);
	
	if (this.hullStartCell) {
		const hullStart = {x: this.hullStartCell.x, y: this.hullStartCell.y};
		const serializedHullStart = JSON.stringify(hullStart);
		localStorage.setItem("hullStart", serializedHullStart)
	}
};

// Cell

function Cell(grid, x, y) {
	this.grid = grid;
	this.x = x;
	this.y = y;
	this.isSet = false;
	this.isOpen = false;
	this.isClosed = false;
	this.createDOMElement();
}

Cell.prototype.createDOMElement = function () {
	this.element = document.createElement("div");
	
	this.element.style.position = "absolute";
	
	this.resize();
	
	this.reset();
	
	this.element.onmousedown = (e) => 
		e.button === 0 ? 
		this.grid.activate(this) : 
		this.grid.startHullGeneration(this);
	
	document.body.appendChild(this.element);
};

Cell.prototype.resize = function () {
	this.element.style.left = (this.x * this.grid.cellFullSize) + "px";
	this.element.style.top  = (this.y * this.grid.cellFullSize) + "px";
	
	this.element.style.width  = this.grid.cellSize + "px";
	this.element.style.height = this.grid.cellSize + "px";
};

Cell.prototype.reset = function () {
	this.isOpen = false;
	this.isClosed = false;
	this.updateColor();
};

Cell.prototype.setSet = function (isSet) {
	this.isSet = isSet;
	this.updateColor();
};

Cell.prototype.open = function () {
	this.isOpen = true;
	this.updateColor();
};

Cell.prototype.close = function () {
	this.isClosed = true;
	this.updateColor();
};

Cell.prototype.updateColor = function () {
	let color;
	
	if (this.isClosed)
		color = CLOSED_COLOR;
	else
	if (this.isOpen)
		color = OPEN_COLOR;
	else
	if (this.isSet)
		color = SET_COLOR;
	else
		color = DEFAULT_COLOR;

	this.element.style.backgroundColor = color;
};

// Point

function Point(grid, x, y) {
	this.grid = grid;
	this.x = x;
	this.y = y;
	this.weight = undefined;
	this.createDOMElement();
}

Point.prototype.createDOMElement = function () {
	this.element = document.createElement("div");
	
	this.element.style.position = "absolute";
	this.element.style.transform = "translate(-50%, -50%)";
	this.element.style.borderRadius = "50%";
	
	this.resize();
	
	this.reset();
	
	document.body.appendChild(this.element);
};

Point.prototype.resize = function () {
	this.element.style.left = (this.x * this.grid.cellFullSize - this.grid.cellPadding / 2) + "px";
	this.element.style.top  = (this.y * this.grid.cellFullSize - this.grid.cellPadding / 2) + "px";
	
	const POINT_SIZE_RATIO = 0.4;
	
	this.element.style.width  = (this.grid.cellSize * POINT_SIZE_RATIO) + "px";
	this.element.style.height = (this.grid.cellSize * POINT_SIZE_RATIO) + "px";
};

Point.prototype.reset = function () {
	this.weight = undefined;
	this.updateColor();
};

Point.prototype.updateColor = function () {
	let color;
	
	switch (this.weight) {
	case undefined:
		color = "rgba(0, 0, 0, 0.0)";
		break;
	case 1:
		color = POINT_CONVEX_CORNER_COLOR;
		break;
	case 2: 
		color = POINT_COLINEAR_COLOR;
		break;
	case 3:
		color = POINT_CONCAVE_CORNER_COLOR;
		break;
	case 4:
		color = POINT_INSIDE_COLOR;
		break;
	default:
		console.assert(false);
		break;
	}

	this.element.style.backgroundColor = color;
};

// main

function main() {
	const grid = new Grid(16, 16);
	
	document.body.onresize = grid.resize.bind(grid);
}

main();