#version 460 core

out vec4 FragColor;

#include "random"
#include "heightmaperosioncommon"

uniform sampler2D frogTex;
uniform uint uFrames;
uniform vec4 uMouse;
uniform vec2 uRes;
uniform mat4 uInvViewProjMatrix;
uniform vec3 uCameraPos;
uniform uint uDebugMode;


 #define SHADOWS
 #define LARGE_AO


struct Ray {
    vec3 ro;
    vec3 rd;
};

Ray getRay (vec2 uv) {
    float near = 0.1;
    float far = 100000.0;
    Ray ray;
    ray.ro = uCameraPos;
    ray.rd = normalize((uInvViewProjMatrix * vec4(uv * (far - near), far + near, far - near)).xyz);
    return ray;
}


float avgof(float x, float y, float z, float w) {
    return 0.25 * (x + y + z + w);
}

vec3 colorTerrain(vec4 groundComp, vec3 normal) {
    vec3 rock = vec3(0.1);
    vec3 sand = vec3(0.8,0.65,0.4);
    vec3 water = vec3(0.2,0.7,0.8);
    vec3 grass = vec3(0.5,0.7,0.2);
    vec3 snow = vec3(0.95);
  //  setSeed(floatBitsToUint(normal));
    vec3 gravel = vec3(0.15 ) + 0.2*vec3(random()*random());
    float height = groundComp.x + groundComp.y+ groundComp.z + groundComp.w;

    vec3 c = rock;
    c = mix(c,gravel,clamp(4.0 * (groundComp[LARGE]),0.0,1.0));
    c = mix(c,sand,clamp(4.0 * (groundComp[MEDIUM]+groundComp[SMALL]),0.0,1.0));
    c = mix(c,snow,clamp(pow(normal.z,5.0) * (height-50.0)*0.125,0.0,1.0));
    vec3 sun = normalize(vec3(1.4,1.3,1.0));
    vec3 light = vec3(1.0,0.8,0.65) * 1.0 * max(dot(normal,sun),0.0);
    light += vec3(0.7,0.8,1.0) * 0.2 * max(dot(normal,vec3(0,0,1)),0.0);
    light += vec3(0.5,0.7,1.0) * 0.2 * max(dot(normal,-sun),0.0);
    c *= light;
    return c;
}
vec3 colorTerrain(vec4 groundComp, ivec2 fc, vec3 normal) {
    uvec4 mat = tiles[fc.x%MAPSIZE][fc.y%MAPSIZE].ground >> 24;
    vec3 rock = getColorOfMat(mat[3],fc);
    vec3 sand = getColorOfMat(mat[1],fc);
    vec3 water = vec3(0.2,0.7,0.8);
    vec3 grass = getColorOfMat(mat[1],fc);
    vec3 snow = vec3(0.95);
    vec3 gravel = getColorOfMat(mat[2],fc);
    float height = groundComp.x + groundComp.y+ groundComp.z + groundComp.w;
    #define cheapGround(p1) getGroundHeight(tiles[(p1).x][(p1).y].ground)
    float ao = 1.0;
    float c1 = (height - cheapGround(fc + offsets[UP] * 8)) + (height - cheapGround(fc + offsets[DOWN] * 8))
    + (height - cheapGround(fc + offsets[LEFT] * 8)) + (height - cheapGround(fc + offsets[RIGHT] * 8));

    float c2 = (height - cheapGround(fc + offsets[UP] * 2)) + (height - cheapGround(fc + offsets[DOWN] * 2))
    + (height - cheapGround(fc + offsets[LEFT] * 2)) + (height - cheapGround(fc + offsets[RIGHT] * 2));
    ao = sqrt(tanh(c1 * 0.2 + c2 * 0.8) + 1.0) * 0.5;

    vec3 sunColor = vec3(1.0,0.8,0.65);

    vec3 c = rock;
    c = mix(c,gravel,clamp(4.0 * (groundComp[LARGE]),0.0,1.0));
    c = mix(c,sand,clamp(4.0 * (groundComp[MEDIUM]+groundComp[SMALL]),0.0,1.0));
   //  c = mix(c,snow,clamp(pow(normal.z,3.0) * (height-85.0)*0.125,0.0,1.0));
    vec3 sun = normalize(vec3(2.4,2.3,1.0));

    float sunOcclusion = pow(max(dot(normal,sun), 0.0), 1.0);
    float skyOcclusion = max(dot(normal, vec3(0, 0, 1)), 0.0) * mix(0.25,1.25,ao);

#ifdef LARGE_AO
    for (int i = 0; i < 16; i++) {
        float dst = random() * 512.0;
        float a = random() * 2.0 * 3.14159;
        if (cheapGround(fc + ivec2(cos(a) * dst, sin(a) * dst)) > height + dst * 0.05) {
            skyOcclusion *= 0.8;
        }
    }
#endif

#ifdef SHADOWS
    vec3 pos = vec3(fc, cheapGround(fc) );
    for (int i = 0; i < 16; i++) {
        pos += sun * 16.0 * random();
        if (cheapGround(ivec2(pos.xy) ) >= pos.z) {
            sunOcclusion *= 0.75;
        }
        
    }
#endif

    vec3 light = mix(pow(sunColor,vec3(1.5)),pow(sunColor,vec3(8.0)),pow(1.0-sunOcclusion,6.0)) * 3.0 * sunOcclusion;
    light += vec3(0.7,0.8,1.0) * 0.45 * (skyOcclusion);
    light += pow(sunColor,vec3(4.0)) * 0.2 *  mix(0.25,1.25,ao) * max(dot(normal,-sun),0.0);
    
    
    c *= light;
    // c = normal * 0.5 + 0.5;
     // c = vec3(sunOcclusion);
     //  c = vec3(skyOcclusion);
    return c;
}

vec3 colorWater(TerrainGenTileInfo tile) {
    vec3 cleanWater = vec3(0.3,0.5,1.0);
    vec3 dirtyWater = vec3(1.0,0.0,0.0);
    if(uintBitsToFloat(tile.fluid[WATER]) < 0.001) return vec3(0.5);
    return cleanWater;
}

// from https://www.shadertoy.com/view/XtGGzG
vec3 plasma_quintic( float x )
{
    x = clamp( x , 0.0, 1.0);
    vec4 x1 = vec4( 1.0, x, x * x, x * x * x ); // 1 x x2 x3
    vec4 x2 = x1 * x1.w * x; // x4 x5 x6 x7
    return vec3(
        dot( x1.xyzw, vec4( +0.063861086, +1.992659096, -1.023901152, -0.490832805 ) ) + dot( x2.xy, vec2( +1.308442123, -0.914547012 ) ),
        dot( x1.xyzw, vec4( +0.049718590, -0.791144343, +2.892305078, +0.811726816 ) ) + dot( x2.xy, vec2( -4.686502417, +2.717794514 ) ),
        dot( x1.xyzw, vec4( +0.513275779, +1.580255060, -5.164414457, +4.559573646 ) ) + dot( x2.xy, vec2( -1.916810682, +0.570638854 ) ) );
}
// from https://www.shadertoy.com/view/XtGGzG
vec3 magma_quintic( float x )
{
    x = clamp( x , 0.0, 1.0);
    vec4 x1 = vec4( 1.0, x, x * x, x * x * x ); // 1 x x2 x3
    vec4 x2 = x1 * x1.w * x; // x4 x5 x6 x7
    return vec3(
        dot( x1.xyzw, vec4( -0.023226960, +1.087154378, -0.109964741, +6.333665763 ) ) + dot( x2.xy, vec2( -11.640596589, +5.337625354 ) ),
        dot( x1.xyzw, vec4( +0.010680993, +0.176613780, +1.638227448, -6.743522237 ) ) + dot( x2.xy, vec2( +11.426396979, -5.523236379 ) ),
        dot( x1.xyzw, vec4( -0.008260782, +2.244286052, +3.005587601, -24.279769818 ) ) + dot( x2.xy, vec2( +32.484310068, -12.688259703 ) ) );
}

vec3 skybox(vec3 r) {
    return pow(max(dot(r, vec3(0,0,1)) + 0.5,0.0),1.0/2.2) * vec3(0.4,0.7,0.8);
}

const bool showCrosssection = false ;
const bool showVelocity = false;
const bool showContour = false;
void main() {

    int scale = 1;
    ivec2 offset = ivec2((uMouse.xy / uRes.xy) * float(MAPSIZE));
    offset = ivec2(0, 0   );
    vec2 p = gl_FragCoord.xy;
    vec2 m = uMouse.xy;
    if(showCrosssection) {p.y -= 0.2 * uRes.y; m.y -= 0.2 * uRes.y;}
    ivec2 fc = ivec2(p) / scale  + offset;
    setSeed(uvec2(fc));
    vec2 tileMouse = vec2(m)/vec2(scale)  + offset;
    vec2 tilePos = vec2(p) / vec2(scale) + offset;

    vec2 uv = p / uRes;
    vec2 cuv = (p * 2.0 - uRes) / uRes.y;

    vec4 tex = texture(frogTex, uv);

    vec3 col = tex.rgb * vec3(1,1,1);

    TerrainGenTileInfo tile = tiles[fc.x%MAPSIZE][fc.y%MAPSIZE];
    TerrainGenTileInfo neighbors[4];
    vec4 neighborWater;
    vec4 waterLevels;
    vec4 groundHeights;
    for (int i = 0; i < 4; i++) {
        ivec2 o = offsets[i];
        neighbors[i] = tiles[(fc.x + o.x) % MAPSIZE][(fc.y + o.y) % MAPSIZE];
        unpackedLayer ng[4] = unpackGroundLayer(neighbors[i].ground);
        groundHeights[i] = getGroundHeight(ng);
        neighborWater[i] = uintBitsToFloat(neighbors[i].fluid[WATER]);
        waterLevels[i] = groundHeights[i] + neighborWater[i];
    }
    vec3 normal = sampleNormal(fc);
    //normal = sampleNormal(floor(tilePos * 16.0) / 16.0);
   // tile = upsampleTile(ivec2(fract(tilePos) * float(scale)), tile, neighbors);
   // if(distance(fract(tilePos),vec2(0.5)) > 10.25 || true)tile = sampleTile(tilePos);//
    //d *= 100.0;

    unpackedLayer ground[4] = unpackGroundLayer(tile.ground);

    float water;
    unpackedLayer fluid[3] = unpackFluidLayer(tile.fluid,water);
    vec3 sedComp = vec3(fluid[0].height,fluid[1].height,fluid[2].height);
    float groundLevel = getGroundHeight(ground);
    float waterLevel = water + groundLevel + fluid[0].height + fluid[1].height + fluid[2].height;
    vec4 hd = (waterLevel - waterLevels);
    float largestHD = max(max(abs(hd.x),abs(hd.y)), max(abs(hd.z),abs(hd.w)));

    float totalSediment = fluid[SMALL].height + fluid[MEDIUM].height + fluid[LARGE].height;
    vec4 wout = tile.percentOut * water;

    vec2 flow = vec2(wout[RIGHT] + wout[LEFT], wout[UP] + wout[DOWN]);

    vec4 groundComp = vec4(ground[0].height,ground[1].height,ground[2].height,ground[3].height);

    col = colorTerrain(groundComp + vec4(sedComp*0.0,0.0), fc, normal);

    float percentOut = clamp( ((wout.x + wout.y + wout.z + wout.w) / max(water,0.001)),0.0,1.0);

    vec3 waterScatter = vec3(0.01,0.4,0.7);
    //waterScatter = mix(waterScatter, vec3(0.9), percentOut * 100.0);
    vec3 waterAbsorption = vec3(0.7,0.3,0.1);
    //waterAbsorption = mix(waterAbsorption, vec3(0.0), clamp(percentOut * 100.0,0.0,1.0));
    //col = mix(col,vec3(1),tile.water > 0.005 ? percentOut : 0.0);
    float waterDepth = waterLevel - groundLevel;

    col *= exp(-water * waterAbsorption * 2.0);
    col += vec3(log(1.0 + waterScatter * waterDepth * 122.53)) * 0.01;
    setSeed(uvec3(fc + ivec2(tile.velocity * 1),(uFrames*0+uint(random()*10.0))/10));
    col += vec3(random()) * clamp(dot(abs(tile.velocity)*dt,vec2(1)) * clamp(waterDepth,0.0,0.2) * 7.2 - 0.02, 0.0, 1.0);

    vec3 col2 =  vec3((water) / 0.120);

    float carryingCapacity = sedimentCapacity(tile.velocity,sedComp,water);

    float erosion = streamPower(length(tile.velocity) * dt * water, acos(normal.z)) * 0.5;
    float deposition = pow(1.0 / length(tile.velocity),16.0) * 0.01;
    //  col2 = vec3(erosion);

    //col2 = vec3(carryingCapacity / water) * 0.15;

    uint topLayer = findTopLayer(ground);
    col2 = vec3(groundLevel) * 0.01;

    // col2 = vec3(carryingCapacity / water) * 1.0;
    col2 = vec3(erosion) * 10.05;
    //    col2 = vec3(1) * dot(tile.percentOut,vec4(1));
    // col2 = vec3(ground[topLayer].height) * 0.01;
    col2 = vec3(totalSediment / carryingCapacity) * 0.5 * (water > 0.01 ? 1.0 : 0.0);
    //   col2 = vec3(carryingCapacity);
    float isNegative = tile.velocity.y < 0.0 ? 1.0 : 0.0;
    // col2 = vec3(deposition);
    //col2 = vec3(abs(tile.velocity),isNegative/dt/100000.0) * dt;
    //col = magma_quintic((dot(v2,vec2(1,0))*0.5+0.5)) * length(t.velocity) * 0.15 * uintBitsToFloat(t.fluid[WATER]);
     col2 = magma_quintic(pow(length(tile.velocity) * 0.13 * (water + totalSediment), 0.25));//
    // col2 = vec3(1) * water*3.0;
    
    // col2.r += totalSediment * 0.25;
    // col2.g += dot(groundComp.xyz, vec3(1)) * 0.25;
    // col2.b = 0.0;

    // col2 = vec3(dot(groundComp.xyz, vec3(1))) * 0.125;

    

    col2 = max(col2,vec3(0));
    col2 *= col2;

    if(showContour) {
        float h = groundLevel;

        col2 = normalize(normal * vec3(1.1,1.1,0.05)) * 0.5 + 0.5 - vec3(0.0,0.0,0.4);
        vec3 shading = mix(vec3(0.5,0.6,0.8),vec3(1.0,0.95,0.9),vec3(1.0-pow(fract(h),2.0)));
        col2 = shading * vec3(floor(h) - seaLevel-10.0)/50.0;

        //col2 = mix(col2,vec3(0,0,0),pow(1.0-2.0*abs(fract(h)-0.5),5));
    }
    col2 = max(col2,vec3(0));
    
    col2 = col; 
    col = (uMouse.x * 1 > gl_FragCoord.x) ? col2 : col;
    //if (col.r < 0.0) col.r = 1.0;
    //col = col2;
    // col.r += tile.sediment * 100.0;
    col = sqrt(col);    

    if (showVelocity) {
        
        vec2 subPos = fract(tilePos);
        vec2 centerPos = vec2(0.5);
        vec2 v3 = normalize(tile.velocity);
        vec2 p2 = centerPos;

        col = clamp(col,vec3(0),vec3(1));
        for(int i = 0; i < 15; i++) {
            float d = distance(p2,subPos);
            if (d < 0.05) {col += 3.0*vec3(0.3,-0.2,-0.5) * length(tile.velocity) * clamp(water,0.01,0.05) * 250.0;}
            p2 += v3 * 0.1 ;
        }

    }

    if(fc.x < 0 || fc.y < -99999 || fc.x > MAPSIZE-1 || fc.y > MAPSIZE-1)col = mix(vec3(0.3,0.2,0.6),vec3(0.9,0.6,0.1),1.0);//

    tile = tiles[int(p.x)][int(p.y)];
    vec2 crossHairSize = vec2(15.0,35.0);
    vec2 influence = (distance(p,uMouse.xy) - crossHairSize) / -crossHairSize;
    influence = smoothstep(0.0,1.0,influence);
    if (influence.x > 0.0 && uMouse.z > 0.5 || distance(p,vec2(1000,680))<-5.0) {


        tiles[int(p.x)][int(p.y)].fluid[WATER] = floatBitsToUint(0.013+uintBitsToFloat(tile.fluid[WATER]));
        tiles[int(p.x)][int(p.y)].velocity = 0.4 * vec2(-20,1.0);
    }
    else if (influence.y > 0.0 && uMouse.w > 0.5) {
        ground = unpackGroundLayer(tile.ground);

        fluid = unpackFluidLayer(tile.fluid,water);
        //water += 16.0;
        topLayer = findTopLayer(ground);
        ground[topLayer].height = max(ground[topLayer].height-0.1*max(influence.y,0.0),0.0);
        //fluid[0].height += 0.0001;
        tiles[int(p.x)][int(p.y)].ground = packGroundLayer(ground);
        tiles[int(p.x)][int(p.y)].fluid = packFluidLayer(fluid,water);
    }


    if(abs(distance(vec2(fc),uMouse.xy)-crossHairSize.x) <= 0.5) col = vec3(1,0,0);
    if(crossHairSize.x != crossHairSize.y && abs(distance(vec2(fc),uMouse.xy)-crossHairSize.y) <= 0.5) col = vec3(0,1,0);
// col.rgb = vec3(1) * (tile.water) / 0.025;

//if(fc.x < 0 || fc.y < -99999 || fc.x > MAPSIZE-1 || fc.y > MAPSIZE-1)col = mix(vec3(0.3,0.2,0.6),vec3(0.9,0.6,0.1),1.0);//

if (any(isnan(col))) {
    col = vec3(1,0,1);
}
if (any(isinf(col))) {
    col = vec3(0,1,1);
}
FragColor = vec4(col, 1);
}