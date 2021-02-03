// references
// https://permadi.com/1996/05/ray-casting-tutorial-table-of-contents/
// https://lodev.org/cgtutor/raycasting.html
// https://github.com/slk500/raycasting-js

"use strict";

// STEP 1
let app = new PIXI.Application({ 
    width: 256,
    height: 256,
    antialias: true,    // default: false
    transparent: false, // default: false
    resolution: 1       // default: 1
});
app.renderer.autoDensity = true;
app.renderer.resize(window.innerWidth, window.innerHeight);

// add the canvas that Pixi automatically created
document.body.appendChild(app.view);

// alias shorthand
const Graphics = PIXI.Graphics;

// screen container
const screen = new PIXI.Container();
screen.scale.set(1.8);
app.stage.addChild(screen);

// minimap container
const minimap = new PIXI.Container();
minimap.scale.set(0.4);
app.stage.addChild(minimap);

const bodies = [];
const updateLoop = function() {
    for(let body of bodies) {
        body.update();
    }
    screen.y = -300;
};

//register the update loop
app.ticker.add(delta => updateLoop(delta));

////////// Game classes /////////

// STEP 2
class MiniMap {
    constructor() {
        this.data = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1],
            [1, 0, 0, 3, 0, 0, 1, 0, 0, 3, 1, 0, 1, 0, 1],
            [1, 0, 0, 3, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 0, 2, 3, 1, 1, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ];
        this.tileSize = 64;
        this.mapHeight = this.data.length * this.tileSize;
        this.mapWidth = this.data[0].length * this.tileSize;
        console.log("init map with", this.mapWidth, this.mapHeight);

        // draw boundary
        let mapBounds = new Graphics();
        mapBounds.beginFill(0xffffff, 1)
        .drawRect(0, 0, this.mapWidth, this.mapHeight)
        .endFill();
        minimap.addChild(mapBounds);

        // draw blocks
        for(let row = 0; row < this.data.length; row++) {
            for(let col = 0; col < this.data[row].length; col++) {
                let rectangle = new Graphics();
                rectangle.x = (col * this.tileSize);
                rectangle.y = (row * this.tileSize);
                rectangle.lineStyle(2, 0x312c51, 0.3);
                if(this.data[row][col] > 0) {
                    rectangle.beginFill(0x312c51, 1);
                } else {
                    rectangle.beginFill(0, 0);
                }
                rectangle.drawRect(0, 0, this.tileSize, this.tileSize).endFill();
                minimap.addChild(rectangle);
            }
        }
    }

    // are we within map bounds
    isInBounds(x, y) {
        if(x <= 0 || x >= this.mapWidth || y <= 0 || y >= this.mapHeight) {
            return false;
        }
        return true;
    }

    // check if this x,y can be traversed or if its blocked with a solid wall
    canWalk(x, y) {
        if(!this.isInBounds(x, y)) {
            return false;
        }
        if(this.data[Math.floor(y/this.tileSize)][Math.floor(x/this.tileSize)] != 0) {
            return false;
        }
        return true;
    }
}

// STEP 3
class Player {
    constructor(gameMap) {
        this.map = gameMap;
        this.startx = this.map.mapWidth/2;
        this.starty = this.map.mapHeight/2;

        this.size = 4;
        this.rotAngle = Math.PI/2; // direction where player is facing
        this.moveSpeed = 2; // speed by which player moves
        this.turnSpeed = 0.02;  // speed by which player turns
        this.turnDir = 0; // left/right
        this.moveDir = 0; // forward/backward
        
        this.fov = 75 * Math.PI/180; // 75 degree in radians, how much player can see
        // distance between player and the virtual plane where the walls
        // will be projected
        this.distanceToProjectionPlane = this.map.mapWidth/2 / Math.tan(this.fov);
        
        this.rayWidth = 10; // how pixelated will the walls look, also reduces computation
        // this.rayCount = 1;
        this.rayCount = Math.floor(this.map.mapWidth / this.rayWidth);
        this.rays = [];
        
        // draw player body
        this.body = new Graphics();
        this.body.lineStyle(2, 0xFFFFFF, 1);
        this.body.x = this.startx;
        this.body.y = this.starty
        this.body.drawCircle(0, 0, this.size);
        minimap.addChild(this.body);
        
        // Step 7

        // gen rays
        for(let i = 0; i < this.rayCount; i++) {
            this.rays.push(new Ray(i, this.rayWidth));
        }
        console.log("init number of rays", this.rayCount);
        
        // STEP 4a

        // draw face direction
        this.faceSize = 30;
        this.face = new Graphics();
        this.face.lineStyle(2, 0xFF00FF, 1);
        this.face.moveTo(0, 0);
        this.face.lineTo(Math.cos(this.rotAngle) * this.faceSize, Math.sin(this.rotAngle) * this.faceSize);
        this.face.x = this.startx;
        this.face.y = this.starty;
        minimap.addChild(this.face);
    }

    update() {
        // STEP 5b

        // update rotation
        this.rotAngle += this.turnDir * this.turnSpeed;

        // gen next position for the player
        const moveStep = this.moveSpeed * this.moveDir;
        const xNext = this.body.x + moveStep * Math.cos(this.rotAngle);
        const yNext = this.body.y + moveStep * Math.sin(this.rotAngle);

        // map collision detection
        if(this.map.canWalk(xNext, yNext)) {
            this.body.x = xNext;
            this.body.y = yNext;
        }

        // STEP 4b

        // draw player facing side
        this.face.x = this.body.x;
        this.face.y = this.body.y;
        this.face.clear().lineStyle(2, 0xFF00FF, 1)
        .lineTo(Math.cos(this.rotAngle) * this.faceSize, Math.sin(this.rotAngle) * this.faceSize);


        //Step 8

        // cast rays in player face direction
        const rayAngleStart = this.rotAngle - this.fov / 2;
        const rayAngleStep = this.fov / this.rayCount; 
        for(let i=0; i < this.rays.length; i++) {
            let rayAngle = rayAngleStart + i * rayAngleStep;
            this.rays[i].update(this, this.map, rayAngle);
        }
    }
}

// STEP 6
class Ray {
    constructor(index, width) {
        this.index = index;
        this.size = 9999;
        this.angle = 0;
        this.hitx = 0;
        this.hity = 0;
        this.hitDist = this.size;
        this.x = 0;
        this.y = 0;

        this.body = new Graphics();
        this.body.moveTo(this.x, this.y);
        minimap.addChild(this.body);

        // draw wall
        this.wallWidth = width;
        this.wallHeight = window.innerHeight/4;
        this.wall = new Graphics();
        this.wall.x = this.index * this.wallWidth;
        this.wall.y = window.innerHeight/2 - this.wallHeight/2;
        this.wall.beginFill(0xFFFFFF, 1)
        .drawRect(0, 0, this.wallWidth, window.innerHeight/2)
        .endFill();
        screen.addChild(this.wall);
    }

    // Step 9
    update(player, map, rayAngle) {
        this.x = player.body.x;
        this.y = player.body.y;

        
        // normalize within 0 to 2PI
        this.angle = rayAngle % (Math.PI * 2);
        this.angle = (this.angle < 0) ? Math.PI * 2 + this.angle : this.angle;
        
        // find horizontal collisions
        /////////////////////
        let hWallHit = false;
        let hWallHitX = 0;
        let hWallHitY = 0;

        // find first point where the ray collides on map grid
        let yintercept = Math.floor(this.y / map.tileSize) * map.tileSize;
        yintercept += (this.isPointingDown() ? map.tileSize : 0);

        let xintercept = this.x + ((yintercept - this.y) / Math.tan(this.angle));
        
        // find next grid box delta that we need to keep on adding to previous 
        // intercepts to find the final hit point
        let ystep = map.tileSize * (this.isPointingDown() ? 1 : -1);
        let xstep = map.tileSize / Math.tan(this.angle);
        xstep *= (xstep > 0 && this.isPointingLeft()) ? -1 : 1;
        xstep *= (xstep < 0 && !this.isPointingLeft()) ? -1 : 1;

        let xhitPoint = xintercept;
        let yhitPoint = yintercept;

        while(map.isInBounds(xhitPoint, yhitPoint - !this.isPointingDown())) {
            if(map.canWalk(xhitPoint, yhitPoint - !this.isPointingDown())) {
                xhitPoint += xstep;
                yhitPoint += ystep;
            } else {
                hWallHit = true;
                hWallHitX = xhitPoint;
                hWallHitY = yhitPoint;
                break;
            }
        }

        // find vertical collisions
        /////////////////////
        let vWallHit = false;
        let vWallHitX = 0;
        let vWallHitY = 0;

        // find first point where the ray collides on map grid
        xintercept = Math.floor(this.x / map.tileSize) * map.tileSize;
        xintercept += (this.isPointingLeft() ? 0 : map.tileSize);

        yintercept = this.y + ((xintercept - this.x) * Math.tan(this.angle));

        // find next grid box delta that we need to keep on adding to previous 
        // intercepts to find the final hit point
        xstep = map.tileSize * (this.isPointingLeft() ? -1 : 1);
        ystep = map.tileSize * Math.tan(this.angle);
        ystep *= (ystep > 0 && !this.isPointingDown()) ? -1 : 1;
        ystep *= (ystep < 0 && this.isPointingDown()) ? -1 : 1;

        xhitPoint = xintercept;
        yhitPoint = yintercept;
        while(map.isInBounds(xhitPoint - this.isPointingLeft(), yhitPoint)) {
            if(map.canWalk(xhitPoint - this.isPointingLeft(), yhitPoint)) {
                xhitPoint += xstep;
                yhitPoint += ystep;
            } else {
                vWallHit = true;
                vWallHitX = xhitPoint;
                vWallHitY = yhitPoint;
                break;
            }
        }

        // Calculate both horizontal and vertical distances and choose the smallest value
        const hHitDistance = (hWallHit) ? this.distanceTo(hWallHitX, hWallHitY)
            : this.size;
        const vHitDistance = (vWallHit) ? this.distanceTo(vWallHitX, vWallHitY)
            : this.size;

        // only store the smallest of the distances
        this.hitx = (hHitDistance < vHitDistance) ? hWallHitX : vWallHitX;
        this.hity = (hHitDistance < vHitDistance) ? hWallHitY : vWallHitY;
        this.hitDist = Math.min(hHitDistance, vHitDistance);

        // update ray position to refresh render
        this.body.clear().lineStyle(2, 0xc6d461, 1)
        .moveTo(this.x, this.y)
        .lineTo(this.hitx, this.hity);


        // Step 9

        // update wall rendering
        // find perpendicular distance to correct fisheye issue
        const wallPerpendicularDist = this.hitDist * Math.cos(this.angle - player.rotAngle);
        
        //                          Actual Slice Height
        // Projected Slice Height= --------------------- * Distance to Projection Plane
        //                         Distance to the Slice
        this.wallHeight = (map.tileSize / wallPerpendicularDist) * player.distanceToProjectionPlane;
        // giving height a boost
        this.wallHeight *= 3;
        
        this.wall.y = window.innerHeight/2 - this.wallHeight/2;

        // generate wall color based on how far it is from player
        let wallColor = 200/wallPerpendicularDist;
        wallColor = Math.max(0, wallColor);
        wallColor = Math.min(1, wallColor);
        
        this.wall.clear()
        .beginFill(PIXI.utils.rgb2hex([wallColor, wallColor, wallColor]), 1)
        .drawRect(0, 0, this.wallWidth, this.wallHeight)
        .endFill();

    }

    isPointingDown() {
        return this.angle > 0 && this.angle < Math.PI;
    }

    isPointingLeft() {
        return this.angle > 0.5 * Math.PI && this.angle < 1.5 * Math.PI;
    }

    distanceTo(x1, y1) {
        return Math.sqrt((x1 - this.x) * (x1 - this.x) + (y1 - this.y) * (y1 - this.y));
    }
}

// Step 10
class Skybox {
    constructor() {
        // draw sky from mid to top
        this.skyWidth = window.innerWidth;
        this.skyHeight = window.innerHeight/2;
        this.sky = new Graphics();
        this.sky.beginFill(0x4d375d, 1)
        .drawRect(0, 0, this.skyWidth, this.skyHeight)
        .endFill();
        screen.addChild(this.sky);
    }
}

const skybox = new Skybox();
const gameMap = new MiniMap();

const player = new Player(gameMap);
bodies.push(player);

////// INPUT //////

// Step 5a

function Keyboard(value) {
    let key = {};
    key.value = value;
    key.isDown = false;
    key.isUp = true;
    key.press = undefined;
    key.release = undefined;
    //The `downHandler`
    key.downHandler = event => {
      if (event.key === key.value) {
        if (key.isUp && key.press) key.press();
        key.isDown = true;
        key.isUp = false;
        event.preventDefault();
      }
    };
  
    //The `upHandler`
    key.upHandler = event => {
      if (event.key === key.value) {
        if (key.isDown && key.release) key.release();
        key.isDown = false;
        key.isUp = true;
        event.preventDefault();
      }
    };
  
    //Attach event listeners
    const downListener = key.downHandler.bind(key);
    const upListener = key.upHandler.bind(key);
    
    window.addEventListener(
      "keydown", downListener, false
    );
    window.addEventListener(
      "keyup", upListener, false
    );
    
    // Detach event listeners
    key.unsubscribe = () => {
      window.removeEventListener("keydown", downListener);
      window.removeEventListener("keyup", upListener);
    };
    
    return key;
}

const leftKey = Keyboard("ArrowLeft"),
rightKey = Keyboard("ArrowRight"),
upKey = Keyboard("ArrowUp"),
downKey = Keyboard("ArrowDown");

//Up
upKey.press = () => {
    player.moveDir = 1;
};
upKey.release = () => {
    if (!downKey.isDown) {
        player.moveDir = 0;
    }
};

//Down
downKey.press = () => {
    player.moveDir = -1;
};
downKey.release = () => {
    if (!upKey.isDown) {
        player.moveDir = 0;
    }
};

leftKey.press = () => {
    player.turnDir = -1;
};
leftKey.release = () => {
    if (!rightKey.isDown) {
        player.turnDir = 0;
    }
};

//Right
rightKey.press = () => {
    player.turnDir = 1;
};
rightKey.release = () => {
    if (!leftKey.isDown) {
        player.turnDir = 0;
    }
};

////// INPUT ENDS //////