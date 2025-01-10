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

// groundComp: vec4(height[0], height[1], height[2], height[3])
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

// groundComp: vec4(height[0], height[1], height[2], height[3])
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
    c = mix(c,snow,clamp(pow(normal.z,3.0) * (height-85.0)*0.125,0.0,1.0));
    vec3 sun = normalize(vec3(2.4,2.3,1.0));

    float sunOcclusion = max(dot(normal,sun),0.0);

    vec3 light = mix(pow(sunColor,vec3(1.5)),pow(sunColor,vec3(8.0)),pow(1.0-sunOcclusion,6.0)) * 1.5 * sunOcclusion;
    light += vec3(0.7,0.8,1.0) * 0.15 * max(dot(normal,vec3(0,0,1)),0.0) * mix(0.25,1.25,ao);
    light += pow(sunColor,vec3(4.0)) * 0.2 *  mix(0.25,1.25,ao) * max(dot(normal,-sun),0.0);
    c *= light;
    return c;
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

void main() {

    vec2 p = gl_FragCoord.xy;
    vec2 m = uMouse.xy;

    ivec2 fc = ivec2(p);
    setSeed(uvec2(fc));

    vec2 uv = p / uRes;
    vec3 col = vec3(0);

    TerrainGenTileInfo tile = tiles[fc.x%MAPSIZE][fc.y%MAPSIZE];
    TerrainGenTileInfo neighbors[4];

    vec3 waterScatter = vec3(0.01,0.4,0.7);
    vec3 waterAbsorption = vec3(0.7,0.3,0.1);

    #define BINARY_REFINE(pos, last, test, iters)  {vec3 under = last; vec3 over = pos;  for (int i = 0; i < iters; i++) { pos = (over + under) * 0.5; if (test) {over = pos;} else{under = pos;} }pos = over;}

    Ray r = getRay(uv * 2.0 - 1.0);
    vec3 rayPos = r.ro;
    int medium = 0;
    TerrainGenTileInfo t;
    bool hit = false;
    vec3 throughput = vec3(1);
    vec3 scatter = vec3(0);
    float dt2 = 0.15;
    setSeed(uvec3(gl_FragCoord.xy,uFrames*17 + 1241u));
    dt2 += dt2 * random();
    float stepSizeDivider = max(length(r.rd.xy),0.05);
    vec2 hw;
    for (int i = 0; i < 100; i++) {

        if (any(lessThan(rayPos.xy,vec2(0))) || any(greaterThanEqual(rayPos,vec3(MAPSIZE,MAPSIZE,200)))) break;
        hw = sampleTileHeight(ivec2(rayPos.xy));

        if (hw.x > rayPos.z) {
            BINARY_REFINE(rayPos, rayPos - r.rd * (dt2/length(r.rd.xy)), sampleTileHeight(ivec2(rayPos.xy)).x + sampleTileHeight(ivec2(rayPos.xy)).y > rayPos.z, 3);
            hw = sampleTileHeight(ivec2(rayPos.xy));
            if (hw.x > rayPos.z) {
                hit = true;
                break;
            }

        }

        if (hw.x + hw.y > rayPos.z) {

            if (medium == 0) {
                scatter += skybox(reflect(r.rd, vec3(0, 0, 1))) * 0.65;
                throughput *= 0.25;
            }
            medium = 1;
            scatter = max(scatter, waterScatter * 0.1);
            throughput *= exp(vec3(0.95, 0.97, 0.99) * -(dt2 / stepSizeDivider) * 0.1);
            scatter += waterScatter * dt2 * 0.1 * throughput;
        }
        else {
            medium = 0;
        }
        rayPos += (r.rd ) * (dt2 / stepSizeDivider);
        dt2 *= 1.05;
    }
    if (!hit) {
        col = vec3(scatter) + skybox(r.rd) * throughput;
    }
    else {
        hw = sampleTileHeight(ivec2(p.xy));
        vec3 overshoot = rayPos;
        vec3 undershoot = rayPos - r.rd * (dt2/length(r.rd.xy));
        BINARY_REFINE(rayPos, rayPos - r.rd * (dt2/length(r.rd.xy)), sampleTileHeight(ivec2(rayPos.xy)).x > rayPos.z, 6);
        for (int i = 0; i < 5; i++) {
            rayPos = (overshoot + undershoot) * 0.5;
            hw = sampleTileHeight(ivec2(rayPos.xy));
            if (hw.x > rayPos.z) {
                overshoot = rayPos;
            }
            else {
                undershoot = rayPos;
            }
        }
        t = sampleTile(ivec2(rayPos.xy));
        fc = ivec2(rayPos.xy);
        vec3 n = sampleNormal(ivec2(rayPos.xy));
        unpackedLayer ground[4] = unpackGroundLayer(t.ground);
        vec4 groundComp = vec4(ground[0].height, ground[1].height, ground[2].height, ground[3].height);
        setSeed(uvec3(rayPos.xy,0));

        col = colorTerrain(groundComp, n) * throughput + scatter;
        col *= 0.1;
        col = sqrt(col);

        float water = 0.0;
        unpackedLayer fluid[3] = unpackFluidLayer(t.fluid,water);
        col += magma_quintic(length(t.velocity) * 0.10 * (water + fluid[0].height + fluid[1].height + fluid[2].height));
        
    }

    // Mouse controls

    tile = tiles[int(p.x)][int(p.y)];
    vec2 crossHairSize = vec2(15.0,35.0);
    vec2 influence = (distance(p, uMouse.xy) - crossHairSize) / -crossHairSize;
    influence = smoothstep(0.0,1.0,influence);
    if (influence.x > 0.0 && uMouse.z > 0.5 || distance(p,vec2(1000,680))<-5.0) {
        tiles[int(p.x)][int(p.y)].fluid[WATER] = floatBitsToUint(0.013+uintBitsToFloat(tile.fluid[WATER]));
        tiles[int(p.x)][int(p.y)].velocity = 0.4 * vec2(-20,1.0);
    }
    else if (influence.y > 0.0 && uMouse.w > 0.5) {
        float water = 0.0;
        unpackedLayer ground[4] = unpackGroundLayer(tile.ground);
        unpackedLayer fluid[3] = unpackFluidLayer(tile.fluid,water);
        //water += 16.0;
        uint topLayer = findTopLayer(ground);
        ground[topLayer].height = max(ground[topLayer].height-0.1*max(influence.y,0.0),0.0);
        //fluid[0].height += 0.0001;
        tiles[int(p.x)][int(p.y)].ground = packGroundLayer(ground);
        tiles[int(p.x)][int(p.y)].fluid = packFluidLayer(fluid,water);
    }


    if(abs(distance(vec2(fc),uMouse.xy) - crossHairSize.x) <= 0.5) col = vec3(1, 0, 0);
    if(crossHairSize.x != crossHairSize.y && abs(distance(vec2(fc), uMouse.xy) - crossHairSize.y) <= 0.5) col = vec3(0,1,0);

    if (any(isnan(col))) {
        col = vec3(1, 0, 1);
    }
    if (any(isinf(col))) {
        col = vec3(0, 1, 1);
    }

    FragColor = vec4(col, 1);
}