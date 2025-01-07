#version 460 core


uniform sampler2D frogTex;
uniform uint uFrames;
uniform vec4 uMouse;
uniform vec2 uRes;
const vec2 table[3] = {
vec2(0, 2.2),
vec2(0, 0),
vec2(2.2, 0)
};
out vec4 vertexColor;
////2
void main ()
{
   // vec2 worldSize = vec2(50) / uRes.y;
    //vec2 screenPos = aPos * uRes.x;2

    gl_Position = vec4(table[gl_VertexID] * 2.0 - 1.0, 0.0, 1.0);
    vertexColor = vec4(1.0,0.0,1.0, 1.0);
}