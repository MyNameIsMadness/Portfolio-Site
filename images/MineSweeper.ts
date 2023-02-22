/* Assignment 1: Space Minesweeper
 * CSCI 4611, Spring 2022, University of Minnesota
 * Instructor: Evan Suma Rosenberg <suma@umn.edu>
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */ 

import * as paper from 'paper';
import { Path, Point, tool, view } from 'paper/dist/paper-core';

class Game 
{
    // Width and height are defined in project coordinates
    // This is different than screen coordinates!
    private width : number;
    private height : number;

    // TypeScript will throw an error if you define a type but don't initialize in the constructor
    // This can be prevented by including undefined as a second possible type
    private ship : paper.Group | undefined;
    private mine : paper.Group | undefined;
    private starfield : paper.Group | undefined;
    private verticies : paper.Point[];
    private line! : paper.Path.Line;
    private velocity : paper.Point;
    private parallax : paper.Point;
    private minefield : paper.Group | undefined;
    private minevelocity : paper.Point;
    private lasers : paper.Group | undefined;
    private laserSymbol : paper.SymbolDefinition;
    private mineSymbol : paper.SymbolDefinition | undefined;
    private booms : paper.Group | undefined;
    private boomSymbol : paper.SymbolDefinition | undefined;
    private laserVector : paper.Point;
    private laserVectors : Array<paper.Point>;
    private mouseVector : paper.Point;
     

    // Random point generator from Kiet on Slack
    private randomRange(min: number, max: number) : number { 
        return Math.random() * (max - min) + min;
    } 

    private randomPoint(minX: number, maxX: number, minY: number, maxY: number) : paper.Point {
        const randomX = this.randomRange(minX, maxX);
        const randomY = this.randomRange(minY, maxY);
        return new paper.Point(randomX, randomY);
    }
    
    constructor()
    {
        paper.setup('canvas');
        this.width = 1200;
        this.height = 800;
        this.verticies = [];
        this.velocity = new paper.Point(0,0);
        this.parallax = new paper.Point(0,0);
        this.minevelocity = new paper.Point(0,0);
        this.laserVector = new paper.Point(0,0);
        this.mouseVector = new paper.Point(0,0);
        this.laserVectors = [];

        var laser = new paper.Path.Rectangle(new paper.Point(0,0), new paper.Size(3, 25));
        laser.fillColor = new paper.Color('yellow');
        this.laserSymbol = new paper.SymbolDefinition(laser);

        var boom = new paper.Path.Star(new Point(0,0), 7, 10, 5);
        boom.fillColor = new paper.Color('red');
        this.boomSymbol = new paper.SymbolDefinition(boom);

    }

    start() : void 
    {
        this.createScene();
        this.resize();

        // This registers the event handlers for window and mouse events
        paper.view.onResize = () => {this.resize();};
        paper.view.onMouseMove = (event: paper.MouseEvent) => {this.onMouseMove(event);};
        paper.view.onMouseDown = (event: paper.MouseEvent) => {this.onMouseDown(event);};
        paper.view.onFrame = (event: GameEvent) => {this.update(event);};

    }

    private createScene() : void 
    {
        // Create a new group to hold the ship graphic
        this.ship = new paper.Group();

        // This line prevents the transformation matrix from being baked directly into its children
        // Instead, will be applied every frame
        this.ship.applyMatrix = false;

        // This code block loads an SVG file asynchronously
        // It uses an arrow function to specify the code that gets executed after the file is loaded
        // We will go over this syntax in class
        paper.project.importSVG('./assets/ship.svg', (item: paper.Item) => {
            // The exclamation point tells TypeScript you are certain the variable has been defined
            item.addTo(this.ship!);
            this.ship!.scale(3);
            this.ship!.position.x = this.width / 2;
            this.ship!.position.y = this.height / 2;
        });

        // Setting up the group for the mine graphic
        this.mine = new paper.Group();
        this.mine.applyMatrix = false;

        this.minefield = new paper.Group();
        this.minefield.applyMatrix = false;

        // Importing the mine asset
        paper.project.importSVG('./assets/mine.svg', (item: paper.Item) => {
            // The exclamation point tells TypeScript you are certain the variable has been defined
            item.addTo(this.mine!);
            this.mine!.scale(4);
            this.mineSymbol = new paper.SymbolDefinition(this.mine!);
            setInterval( () => {
                var r = Math.random();
                if (r < 0.25) {
                    var minePosition = this.randomPoint(-50, this.width+50, -50, 0);
                } else if (r >= 0.25 && r < 0.5) {
                     var minePosition = this.randomPoint(-50, this.width+50, this.height, this.height+50);
                } else if (r >= 0.5 && r < 0.75) {
                    var minePosition = this.randomPoint(-50, 0, -50, this.height+50);
                } else {
                    var minePosition = this.randomPoint(this.width, this.width+50, -50, this.height+50);
                }
                var placeMine = this.mineSymbol!.place(minePosition);
                placeMine.addTo(this.minefield!);
            }, 1600);
        });

           
        // Creation of the starfield
        this.starfield = new paper.Group();
        this.starfield.applyMatrix = false;

        
        var star = new paper.Path.Star(new Point(0,0), 4, 7, 3);
        star.fillColor = new paper.Color('white');
        var starSymbol = new paper.SymbolDefinition(star);

        for (var i = 0; i < 80; i++) {
            var starPosition = this.randomPoint(0, this.width, 0, this.height);
            var placeStar = starSymbol.place(starPosition);
            var s = Math.random();
            placeStar.scale(s);
            placeStar.addTo(this.starfield!);
        } 

        // Creation of lasers
        this.lasers = new paper.Group();
        this.lasers.applyMatrix = false;

        // Creation of explosions
        this.booms = new paper.Group();
        this.booms.applyMatrix = false;
        
        // Line for testing purposes
        this.line = new paper.Path.Line(new paper.Point(0,0), new paper.Point(1,0));
        this.line.applyMatrix = false;
        this.line.strokeColor = new paper.Color('red');
        this.line.strokeWidth = 5;
        this.line.pivot = new paper.Point(0,0);
        this.line.sendToBack();

        // Making sure the ship is in front of the stars
        this.ship!.bringToFront(); 
    }

    // This method will be called once per frame
    private update(event: GameEvent) : void
    {
        // Movement of the starfield
        if(this.velocity!.length > 0) {
            
            for(var j = 0; j < this.starfield!.children.length; j++) {
                var scalarx = this.starfield!.children[j].scaling.x;
                this.parallax.x = this.velocity.x * scalarx;
                var scalary = this.starfield!.children[j].scaling.y;
                this.parallax.y = this.velocity.y * scalary;
                this.starfield!.children[j].translate(this.parallax);
            }

        }

        // Illusion of infinite space
        for (var i = 0; i < this.starfield!.children.length; i++){
            var xpos = this.starfield!.children[i].position.x;
            var ypos = this.starfield!.children[i].position.y;
            if (xpos >= this.width) {
                this.starfield!.children[i].position.x = 0;
            }
            if (xpos < 0) {
                this.starfield!.children[i].position.x = this.width;
            }
            if (ypos >= this.height) {
                this.starfield!.children[i].position.y = 0;
            }
            if (ypos < 0) {
                this.starfield!.children[i].position.y = this.height;
            }
        }
        
        // Makes the mines home into the ship while spinning
        for(var p = 0; p < this.minefield!.children.length; p++) {
            this.minefield!.children[p].rotate(.5);
            var minevector = this.minefield!.children[p].position.subtract(paper.view.center);
            this.minevelocity.x = minevector.x * -.005;
            this.minevelocity.y = minevector.y * -.005;
            this.minefield!.children[p].translate(this.minevelocity);
            this.minefield!.children[p].translate(this.velocity);
        }

        // If more than 25 mines, removes the oldest one
        if (this.minefield!.children.length > 15) {this.minefield!.children[0].remove();}
        
        // Everything dealing with shooting the laser and the events that follow
        if (this.lasers!.children.length > 0) {
            for (var i = 0; i < this.lasers!.children.length; i++) {
                // Moves the laser along the normalized path
                this.lasers!.children[i].translate(this.laserVectors[i]);
                var index = this.laserVectors.indexOf(this.laserVectors[i], 0);
                // Removes the laser if it exits the viewing screen
                if (this.lasers!.children[i].position.x < 0 || this.lasers!.children[i].position.x > this.width || this.lasers!.children[i].position.y < 0 || this.lasers!.children[i].position.y > this.height) {
                    this.lasers!.children[i].remove(); 
                    if (index > -1) {
                        this.laserVectors.splice(index, 1);
                    }
                } 
                // Removes both the mine and the laser if they collide, add explosion
                for (var j = 0; j < this.minefield!.children.length; j++) {
                    var hitResult = this.minefield!.children[j].intersects(this.lasers!.children[i]); 
                    if (hitResult) {
                        var boom = this.boomSymbol!.place(this.minefield!.children[j].position);
                        boom.scale(7);
                        boom.addTo(this.booms!);
                        this.minefield!.children[j].remove();
                        this.lasers!.children[i].remove();
                        setInterval( () => {boom.remove();}, 100);
                        if (index > -1) {
                            this.laserVectors.splice(index, 1);
                        }
                    }
                }  
            }
        }
    }

    // This handles dynamic resizing of the browser window
    // You do not need to modify this function
    private resize() : void
    {
        var aspectRatio = this.width / this.height;
        var newAspectRatio = paper.view.viewSize.width / paper.view.viewSize.height;
        if(newAspectRatio > aspectRatio)
            paper.view.zoom = paper.view.viewSize.width  / this.width;    
        else
            paper.view.zoom = paper.view.viewSize.height / this.height;
        
        paper.view.center = new paper.Point(this.width / 2, this.height / 2);
        
    }

    private onMouseMove(event: paper.MouseEvent) : void
    {
        // Get the vector from the center of the screen to the mouse position
        this.mouseVector = event.point.subtract(paper.view.center);

        // Creating a vector line that can be switched to be visible for testing
        this.line.visible = false;
        this.line.position = this.ship!.position;
        this.line.scaling.x = this.mouseVector.length;
        this.line.rotation = this.mouseVector.angle;

        // Point the ship towards the mouse cursor by converting the vector to an angle
        // This only works if applyMatrix is set to false
        this.ship!.rotation = this.mouseVector.angle + 90;

        this.velocity.x = 0;
        this.velocity.y = this.mouseVector.length * .025;
        this.velocity = this.velocity.rotate(this.ship!.rotation, new paper.Point(0,0));

    }

    private onMouseDown(event: paper.MouseEvent) : void
    {
        // Used for testing
        this.verticies!.push(new Point(event.point));
        //console.log(event.point);

        // Creating a laser facing the ship's direction with each mouse click
        var laser = this.laserSymbol.place(paper.view.center);
        laser.rotate(this.ship!.rotation, paper.view.center);
        laser.addTo(this.lasers!); 

        // Keeping track of the direction vector for the way the laser should shoot
        this.laserVector = event.point.subtract(paper.view.center);
        this.laserVectors.push(this.laserVector.normalize(10));
        

    } 
}

// This is included because the paper is missing a TypeScript definition
// You do not need to modify it
class GameEvent
{
    readonly delta: number;
    readonly time: number;
    readonly count: number;

    constructor()
    {
        this.delta = 0;
        this.time = 0;
        this.count = 0;
    }
}
    
// Start the game
var game = new Game();
game.start();