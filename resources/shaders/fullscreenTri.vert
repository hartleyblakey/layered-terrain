#version 460 core

const vec2 table[3] = {
    vec2(0, 2.2),
    vec2(0, 0),
    vec2(2.2, 0)
};

void main () {
    gl_Position = vec4(table[gl_VertexID] * 2.0 - 1.0, 0.0, 1.0);
}