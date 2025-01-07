//from https://www.shadertoy.com/view/WttXWX

// bias: 0.020888578919738908 = minimal theoretic limit
uint uuhash11(uint x)
{
    x ^= x >> 17;
    x *= 0xed5ad4bbU;
    x ^= x >> 11;
    x *= 0xac4c1b51U;
    x ^= x >> 15;
    x *= 0x31848babU;
    x ^= x >> 14;
    return x;
}

uint uuhash21(uvec2 x) {
    return uuhash11(uuhash11(x.x) ^ uuhash11(x.y));
}

float ufhash11(uint x)
{
    return float(uuhash11(x)) / float( 0xffffffffU );
}
float ufhash21(uvec2 x)
{
    return float(uuhash21(x)) / float( 0xffffffffU );
}

uint RANDSEED = 2199123;
void setSeed (uint x) {
        RANDSEED = uuhash11(x);
}
void setSeed (vec2 x) {
    RANDSEED = uuhash21(floatBitsToUint(x));
}
void setSeed (uvec2 x) {
    RANDSEED = uuhash21(x);
}
void setSeed (uvec3 x) {
    RANDSEED = uuhash21(uvec2(uuhash21(x.xz),x.y));
}

float random() {
    float r = ufhash11(RANDSEED);
    RANDSEED += 1;
    RANDSEED ^= floatBitsToUint(r);
    RANDSEED += 1;
    return r;
}

float random(float mn, float mx) {
    return random() * (mx-mn) + mn;
}

// The MIT License
// Copyright © 2013 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// https://www.youtube.com/c/InigoQuilez
// https://iquilezles.org
vec2 grad( ivec2 z )  // replace this anything that returns a random vector
{
    // 2D to 1D  (feel free to replace by some other)
    int n = z.x+z.y*11111;

    // Hugo Elias hash (feel free to replace by another one)
    n = (n<<13)^n;
    n = (n*(n*n*15731+789221)+1376312589)>>16;

    #if 0

    // simple random vectors
    return vec2(cos(float(n)),sin(float(n)));

    #else

    // Perlin style vectors
    n &= 7;
    vec2 gr = vec2(n&1,n>>1)*2.0-1.0;
    return ( n>=6 ) ? vec2(0.0,gr.x) :
    ( n>=4 ) ? vec2(gr.x,0.0) :
    gr;
    #endif
}

float noise( in vec2 p )
{
    ivec2 i = ivec2(floor( p ));
    vec2 f =       fract( p );

    vec2 u = f*f*(3.0-2.0*f); // feel free to replace by a quintic smoothstep instead

    return mix( mix( dot( grad( i+ivec2(0,0) ), f-vec2(0.0,0.0) ),
                     dot( grad( i+ivec2(1,0) ), f-vec2(1.0,0.0) ), u.x),
                mix( dot( grad( i+ivec2(0,1) ), f-vec2(0.0,1.0) ),
                     dot( grad( i+ivec2(1,1) ), f-vec2(1.0,1.0) ), u.x), u.y);
}
float fbm(vec2 p, in int n) {
    mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );
    float a = 1.0;
    float y = 0.0;
    for (int i = 0; i < n; i++) {
        y += a * noise(p);
        p = m * p;
        a *= 0.5;
    }
    return y * 0.5 + 0.5;
}