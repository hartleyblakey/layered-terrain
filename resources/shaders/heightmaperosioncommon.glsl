

const int LOGMAPSIZE = 10;
const int MAPSIZE = int(1u << LOGMAPSIZE);


// all units of distance are meters and units of time are seconds, unless otherwise stated

const float dt = 0.01 ;
const float maxVel = 8.0;
const float dx = 16.0; // meters per grid square side
const float g = -9.8;



struct TerrainGenTrackedInfo {
    vec4 averageFlow;
    float debug;
    float recentNetDeposition;
    float netDeposition;
    float averageWater;
};

struct TerrainGenTileInfo {
    uvec4 ground;
    uvec4 fluid;
    uvec4 prevFluid;
    vec4 percentOut;
    vec2 velocity;

    //TerrainGenTrackedInfo tracked;
};




// Ground: restingAngle[4] Erosvity[4] Height[24]
// Fluid:  restingAngle[4] Erosvity[4] Height[24]
struct unpackedLayer {
    float restingAngle;
    float erosivity;
    float height;
};


#define ALLONES_4  15
#define ALLONES_16 65535
#define ALLONES_24 16777215

#define SMALL 0
#define MEDIUM 1
#define LARGE 2
#define BEDROCK 3
#define WATER 3

float unpack4bitfloat(uint u) {
    float v = (float(u + 1) * 0.125);
    return v * v;
}

uint pack4bitfloat(float v) {
    return uint(round(sqrt(v)  * 8.0 - 1.0)) & ALLONES_4;
}

float unpack24bitfloat(uint u) {
    return float(u) / 4096.0;
}
uint pack24bitfloat(float v) {
    return uint(floor(v * 4096.0)) & ALLONES_24;
}

uvec4 getMaterialIDs(TerrainGenTileInfo t) {
    return t.ground >> 24;
}




unpackedLayer unpackGroundLayer(uint pgl) {
    unpackedLayer gl;
    gl.height =         unpack24bitfloat(   (pgl >> 00) & ALLONES_24    );
    gl.erosivity =      unpack4bitfloat(    (pgl >> 24) & ALLONES_4     );
    gl.restingAngle =   1.0/unpack4bitfloat(    (pgl >> 28) & ALLONES_4     );
    return gl;
}

unpackedLayer unpackFluidLayer(uint pfl) {
    unpackedLayer fl;
    fl.height =         unpack24bitfloat(   (pfl >> 00) & ALLONES_24    );
    fl.erosivity =      unpack4bitfloat(    (pfl >> 24) & ALLONES_4     );
    fl.restingAngle =   1.0/unpack4bitfloat(    (pfl >> 28) & ALLONES_4     );
    return fl;
}

unpackedLayer[4] unpackGroundLayer(uvec4 pgl) {
    unpackedLayer gl[4];
    gl[SMALL] = unpackGroundLayer(pgl[SMALL]);
    gl[MEDIUM] = unpackGroundLayer(pgl[MEDIUM]);
    gl[LARGE] = unpackGroundLayer(pgl[LARGE]);
    gl[BEDROCK] = unpackGroundLayer(pgl[BEDROCK]);
    return gl;
}

unpackedLayer[3] unpackFluidLayer(uvec4 pfl, out float water) {
    unpackedLayer fl[3];
    fl[SMALL] = unpackFluidLayer(pfl[SMALL]);
    fl[MEDIUM] = unpackFluidLayer(pfl[MEDIUM]);
    fl[LARGE] = unpackFluidLayer(pfl[LARGE]);
    water = uintBitsToFloat(pfl[WATER]);
    return fl;
}


uint packGroundLayer(unpackedLayer gl) {
    uint pgl = 0u;

    pgl |= (pack24bitfloat(gl.height) << 0);
    pgl |= (pack4bitfloat(gl.erosivity) << 24);
    pgl |= (pack4bitfloat(1.0/gl.restingAngle) << 28);
    return pgl;
}
uint packFluidLayer(unpackedLayer fl) {
    uint pfl = 0u;
    pfl |= (pack24bitfloat(fl.height) << 0);
    pfl |= (pack4bitfloat(fl.erosivity) << 24);
    pfl |= (pack4bitfloat(1.0/fl.restingAngle) << 28);
    return pfl;
}

uvec4 packGroundLayer(unpackedLayer gl[4]) {
    return uvec4(packGroundLayer(gl[0]), packGroundLayer(gl[1]), packGroundLayer(gl[2]), packGroundLayer(gl[3]));
}
uvec4 packFluidLayer(unpackedLayer fl[3], float water) {

    return uvec4(packFluidLayer(fl[0]), packFluidLayer(fl[1]), packFluidLayer(fl[2]), floatBitsToUint(water));
}

unpackedLayer newGroundLayer(uint materialID, float height) {
    return unpackGroundLayer((materialID << 24) | pack24bitfloat(height));
};

float getGroundHeight(uvec4 ground) {
    return unpack24bitfloat(ground.x & ALLONES_24) + unpack24bitfloat(ground.y & ALLONES_24) +
    unpack24bitfloat(ground.z & ALLONES_24) +unpack24bitfloat(ground.w & ALLONES_24);
}

void addTo(inout unpackedLayer a, in unpackedLayer b) {
    a.restingAngle = a.height >= b.height ? a.restingAngle : b.restingAngle;
    a.erosivity = a.height >= b.height ? a.erosivity : b.erosivity;
    a.height += b.height;
}

void addTo(inout unpackedLayer a[4], in unpackedLayer b[4]) {

    addTo(a[0],b[0]);

    addTo(a[1],b[1]);
    addTo(a[2],b[2]);
    addTo(a[3],b[3]);
}
void addTo(inout unpackedLayer a[3], in unpackedLayer b[3]) {
    addTo(a[0],b[0]);
    addTo(a[1],b[1]);
    addTo(a[2],b[2]);
}

void scaleBy(inout unpackedLayer a, in float x) {
    a.height *= x;
}
void scaleBy(inout unpackedLayer a[4], in float x) {
    a[0].height *= x;
    a[1].height *= x;
    a[2].height *= x;
    a[3].height *= x;
}
void scaleBy(inout unpackedLayer a[3], in float x) {
    a[0].height *= x;
    a[1].height *= x;
    a[2].height *= x;
}

uint findTopLayer(in unpackedLayer[4] ground) {
    for (uint topLayer = 0u; topLayer < 4u; topLayer++) {
        if (ground[topLayer].height > 0.0) return topLayer;
    }
return 4u;
}

layout(binding = 2, std430) buffer world{
    TerrainGenTileInfo tiles[][MAPSIZE];
};
const ivec2 offsets[8] = {
ivec2(0,1),
ivec2(0,-1),
ivec2(1,0),
ivec2(-1,0),
        ivec2(1,1),
        ivec2(-1,1),
        ivec2(1,-1),
        ivec2(-1,-1)

};
#define UP 0
#define DOWN 1
#define RIGHT 2
#define LEFT 3

#define UPRIGHT 4
#define UPLEFT 5
#define DOWNRIGHT 6
#define DOWNLEFT 7



const vec3 GRAINSIZEMM = vec3(        0.005,
                                      0.5,
                                      8.0
);
const vec3 SETTLINGVELOCITYMMS = vec3(       0.001,
                                             80.0,
                                             300.0
);
float weightedAverage(in vec3 values, in vec3 weights) {
    return (values[0] * weights[0] + values[1] * weights[1] + values[2] * weights[2]) / (weights[0] + weights[1] + weights[2]);
}
float weightedMedian(in vec3 values, in vec3 weights) {
    float v = (values[0] * weights[0] + values[1] * weights[1] + values[2] * weights[2]) / (weights[0] + weights[1] + weights[2]);

    vec3 weighted = values * weights;


    int middle;
    for (middle = 0; middle < 3; middle++)
        if (weighted[middle] < weighted[(middle + 1) % 3] && weighted[middle] > weighted[(middle + 2) % 3]
        ||
        weighted[middle] > weighted[(middle + 1) % 3] && weighted[middle] < weighted[(middle + 2) % 3])
             break;

    return values[middle];
}



#define IDFROMFLOATMAT(angle, erosivity) ((pack4bitfloat(angle) << 4) | (pack4bitfloat(erosivity)))
#define IDFROMMAT(angle, erosivity) ((angle << 4) | erosivity)





#define GRANITE uvec2(2u, BEDROCK)
#define GRAVEL  uvec2(121u, LARGE)
#define GRAYSAND uvec2(156u, MEDIUM)
#define SILT uvec2(175u, SMALL)
#define CLAY uvec2(41u, BEDROCK)
#define WETCLAY uvec2(250u, MEDIUM)
#define DIRT uvec2(124u, MEDIUM)




#define MATERIALID 0
#define LAYER 1

#define SP_m 0.5
#define SP_n 1.0
#define SP_K 1.0
float streamPower(float A, float S) {
    return SP_K * pow(A, SP_m) * pow(S, SP_n);
}
uvec2 erodesInto(uint mat) {
    float r = random();
    switch (mat) {
        case GRANITE.x:
            return GRAVEL;
        case GRAVEL.x:
            return r > 0.8 ? GRAYSAND : GRAVEL;
        case GRAYSAND.x:
            return GRAYSAND;
        case SILT.x:
            return SILT;
        case CLAY.x:
            return WETCLAY;
        case DIRT.x:
            return SILT;
        case WETCLAY.x:
            return WETCLAY;
       }
     return uvec2(mat,1);
}

uint getLayerOfMat(uint mat) {
    switch (mat) {
        case GRANITE.x:
            return GRANITE.y;
        case GRAVEL.x:
            return GRAVEL.y;
        case GRAYSAND.x:
            return GRAYSAND.y;
        case SILT.x:
            return SILT.y;
        case CLAY.x:
            return CLAY.y;
        case DIRT.x:
            return DIRT.y;
        case WETCLAY.x:
            return WETCLAY.y;
       }
     return 3u;
}

vec3 getColorOfMat(uint mat, ivec2 pos) {
    switch (mat) {
        case GRANITE.x:
            return vec3(0.1);
        case GRAVEL.x:
            return vec3(0.15 ) + 0.2 * vec3(random()*random());
        case GRAYSAND.x:
            return vec3(0.8,0.65,0.4);
        case SILT.x:
            return vec3(0.3,0.15,0.06);
        case CLAY.x:
            return vec3(0.4,0.15,0.1);
        case DIRT.x:
            return vec3(0.3,0.15,0.06);
        case WETCLAY.x:
            return vec3(0.4,0.15,0.1) * 0.4;
    }
    return round(vec3(random(),random(),random()));
}

const float SEDIMENTCOEF = 2.5;
const float seaLevel = 14.0;


float sedimentCapacity(in float velocity, in vec3 currentSedimentComp, in float depth) {
    const float totalSediment = currentSedimentComp.x + currentSedimentComp.y + currentSedimentComp.z;
    const float medianGrainSize = totalSediment > 0.0 ? weightedMedian(GRAINSIZEMM, currentSedimentComp) : GRAINSIZEMM[0];
    const float averageSettlingVelocity = totalSediment > 0.0 ? weightedAverage(SETTLINGVELOCITYMMS, currentSedimentComp) : SETTLINGVELOCITYMMS[0];
    const float U2 = velocity * velocity;
    const float U3 = U2 * velocity;
    const float gh = abs(-g * depth);
    const float y = SEDIMENTCOEF * (0.0261 * ((U2 * medianGrainSize) / (gh * depth)) + 0.0142 * ((U3) / (gh * averageSettlingVelocity)) + 1.0459);
    return clamp(y,0.0,depth * 4.0);
}
float sedimentCapacity(in vec2 velocity, in vec3 currentSedimentComp, in float depth) {
    return sedimentCapacity(length(velocity), currentSedimentComp, depth);
}


float getGroundHeight(unpackedLayer[4] ground) {
    return ground[BEDROCK].height + ground[LARGE].height + ground[MEDIUM].height + ground[SMALL].height;
}

float getWaterLevel(unpackedLayer[4] ground, float water) {
    return getGroundHeight(ground) + water;
}

vec3 sampleNormal (ivec2 fc) {
    TerrainGenTileInfo neighbors[4];
    for (int i = 0; i < 4; i++) {
        ivec2 o = offsets[i];
        neighbors[i] = tiles[(fc.x + o.x) % MAPSIZE][(fc.y + o.y) % MAPSIZE];
    }
    vec4 waterAmounts = uintBitsToFloat(uvec4(neighbors[0].fluid[WATER], neighbors[1].fluid[WATER], neighbors[2].fluid[WATER], neighbors[3].fluid[WATER]));
    vec4 groundHeights;
    for (int i = 0; i < 4; i++)
        groundHeights[i] = getGroundHeight(unpackGroundLayer(neighbors[i].ground));

    vec4 waterLevels = groundHeights + waterAmounts;

    vec3 tangentX = vec3(1,0,waterLevels[RIGHT]) - vec3(-1,0,waterLevels[LEFT]);
    vec3 tangentY = vec3(0,1,waterLevels[UP]) - vec3(0,-1,waterLevels[DOWN]);
    return normalize(cross(tangentX, tangentY));
}
vec3 sampleNormal (vec4 waterLevels) {
    vec3 tangentX = vec3(1,0,waterLevels[RIGHT]) - vec3(-1,0,waterLevels[LEFT]);
    vec3 tangentY = vec3(0,1,waterLevels[UP]) - vec3(0,-1,waterLevels[DOWN]);
    return normalize(cross(tangentX, tangentY));
}
/*
vec3 sampleNormal (ivec2 fc, TerrainGenTileInfo n[4]) {
    vec3 tangentX = vec3(1,0,n[RIGHT].height + n[RIGHT].water) - vec3(-1,0,n[LEFT].height+n[LEFT].water);
    vec3 tangentY = vec3(0,1,n[UP].height + n[UP].water) - vec3(0,-1,n[DOWN].height + n[DOWN].water);
    return normalize(cross(tangentX, tangentY));
}
*/
TerrainGenTileInfo sampleTile(in ivec2 fc) {
    return tiles[fc.x % MAPSIZE][fc.y % MAPSIZE];
}

#define interpolateSample (dx, h, rl, ud, c) mix( mix(h, rl, abs(dx.x-0.5)), mix(ud, c, abs(dx.x-0.5)), abs(dx.y-0.5))

#define interpolateStructureSample(dx, h, rl, ud, c, name) mix( mix(h.name, rl.name, abs(dx.x-0.5)), mix(ud.name, c.name, abs(dx.x-0.5)), abs(dx.y-0.5))

#define interpolateProcessedStructureSample(dx, h, rl, ud, c, name, func) mix( mix(func(h.name), func(rl.name), abs(dx.x-0.5)), mix(func(ud.name), func(c.name), abs(dx.x-0.5)), abs(dx.y-0.5))

vec2 sampleTileHeight(in ivec2 p) {
    TerrainGenTileInfo t = sampleTile(p);
    vec2 r;
    r.x = getGroundHeight(unpackGroundLayer(t.ground));
    r.y = uintBitsToFloat(t.fluid[WATER]);
    return r;
}
/*
TerrainGenTileInfo sampleTile(in vec2 p) {

    ivec2 i = ivec2(p);
    TerrainGenTileInfo H = sampleTiles(i);
    TerrainGenTileInfo t = H;

    vec2 dx = fract(p);

    TerrainGenTileInfo RL = sampleTiles(ivec2(p) + offsets[dx.x > 0.5 ? RIGHT : LEFT]);
    TerrainGenTileInfo UD = sampleTiles(ivec2(p) + offsets[dx.y > 0.5 ? UP : DOWN]);
    TerrainGenTileInfo C = sampleTiles(ivec2(p) + ivec2(round(dx) * 2.0 - 1.0));


    t.water = interpolateStructureSample(dx, H, RL, UD, C, water);
    t.height = interpolateStructureSample(dx, H, RL, UD, C, height);
    t.sediment = interpolateStructureSample(dx, H, RL, UD, C, sediment);


    vec2 dir = interpolateProcessedStructureSample(dx, H, RL, UD, C, tracked.averageFlow, normalize);
        float len = interpolateProcessedStructureSample(dx, H, RL, UD, C, tracked.averageFlow, length);
    t.tracked.averageFlow = normalize(dir) * len;



    t.tracked.averageWater = interpolateStructureSample(dx, H, RL, UD, C, tracked.averageWater);
    t.tracked.recentDeposition = interpolateStructureSample(dx, H, RL, UD, C, tracked.recentDeposition);

        return t;


}

vec2 sampleTileHeight(in vec2 p) {

ivec2 i = ivec2(p);
TerrainGenTileInfo H = sampleTiles(i);
vec2 t;
t.x = H.height;
t.y = H.water;
return t;
vec2 dx = fract(p);

TerrainGenTileInfo RL = sampleTiles(ivec2(p) + offsets[dx.x > 0.5 ? RIGHT : LEFT]);
TerrainGenTileInfo UD = sampleTiles(ivec2(p) + offsets[dx.y > 0.5 ? UP : DOWN]);
TerrainGenTileInfo C = sampleTiles(ivec2(p) + ivec2(round(dx) * 2.0 - 1.0));

t.x = interpolateStructureSample(dx, H, RL, UD, C, height);
t.y = interpolateStructureSample(dx, H, RL, UD, C, water);

    vec2 flow = interpolateStructureSample(dx, H, RL, UD, C, tracked.averageFlow);
    float flowLen = interpolateProcessedStructureSample(dx, H, RL, UD, C, tracked.averageFlow,length);
  //  t.y = max((abs(flow.x) + abs(flow.y)) * 40.0,t.y);
//t.y = max(flowLen * 40.0,t.y);

return t;
return round(t * 128.0) / 128.0;


}

vec3 sampleNormal (vec2 p) {
    vec2 n[4];
    for (int i = 0; i < 4; i++) {
        vec2 o = offsets[i];
        n[i] = sampleTileHeight(p + o * 0.5) / 0.5;
    }
    vec3 tangentX = vec3(1,0,n[RIGHT].x + n[RIGHT].y) - vec3(-1,0,n[LEFT].x+n[LEFT].y);
    vec3 tangentY = vec3(0,1,n[UP].x + n[UP].y) - vec3(0,-1,n[DOWN].x + n[DOWN].y);
    return normalize(cross(tangentX, tangentY));
}
*/