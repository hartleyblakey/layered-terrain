#include <cstdio>
#include <glad/glad.h>
#include <glm/glm.hpp>
#include <glm/gtx/euler_angles.hpp>
#include <stb_image.h>

#include "imgui/imgui.h"
#include "imgui/imgui_impl_glfw.h"
#include "imgui/imgui_impl_opengl3.h"


#include <GLFW/glfw3.h>

#include <graphics/shader.h>
#include <graphics/texture.h>
#include "main.h"

const double PI = glm::pi<double>();

using namespace glm;
const char* getSeverity(GLenum severity) {
    switch(severity) {
        case GL_DEBUG_SEVERITY_HIGH :
            return "\033[1;31mHigh\033[0;37m";
        case GL_DEBUG_SEVERITY_MEDIUM :
            return "\033[1;33mMedium\033[0;37m";
        case GL_DEBUG_SEVERITY_LOW :
            return "\033[0;33mLow\033[0;37m";
        case GL_DEBUG_SEVERITY_NOTIFICATION :
            return "\033[0;32mNotification\033[0;37m";
        default:
            return "Other";
    }
}
const char* getSource(GLenum source) {
    switch(source) {
        case GL_DEBUG_SOURCE_API :
            return "Call to OGL API";
        case GL_DEBUG_SOURCE_WINDOW_SYSTEM :
            return "Call to Window System API";
        case GL_DEBUG_SOURCE_SHADER_COMPILER :
            return "Shader Compiler";
        case GL_DEBUG_SOURCE_THIRD_PARTY :
            return "Third Party";
        case GL_DEBUG_SOURCE_APPLICATION :
            return "Application";
        case GL_DEBUG_SOURCE_OTHER :
            return "Other";
        default:
            return "Not listed in docs :gasp:";
    }
}
const char* getType(GLenum type) {
    switch(type) {
        case GL_DEBUG_TYPE_ERROR :
            return "Error";
        case GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR :
            return "Deprecated Behavior";
        case GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR :
            return "Undefined Behavior";
        case GL_DEBUG_TYPE_PORTABILITY :
            return "Not Portable";
        case GL_DEBUG_TYPE_PERFORMANCE :
            return "Performance Issue";
        case GL_DEBUG_TYPE_MARKER :
            return "Command Stream Annotation";
        default:
            return "group push, group pop, or other";
    }
}
void GLAPIENTRY
MessageCallback( GLenum source,
                 GLenum type,
                 GLuint id,
                 GLenum severity,
                 GLsizei length,
                 const GLchar* message,
                 const void* userParam )
{
  fprintf( stderr, "GL CALLBACK: %s type = %s, severity = %s, source = %s, message:\n\t---\033[1;37m%s\033[0;37m---\n",
           ( type == GL_DEBUG_TYPE_ERROR ? "** GL ERROR **" : "" ),
            getType(type), getSeverity(severity), getSource(source), message );
}

bool framebufferSizeChanged = false;
int pxwidth = 800;
int pxheight = 600;

vec3 camPos = vec3(100);
vec3 camForward = {0,1,0};
vec3 camRight = {1,0,0};
vec3 camUp = {0,0,1};
dvec2 lastMouse = {0,0};
mat4 projectionMatrix = perspective(radians(45.0), double(pxwidth) / double(pxheight), 0.1, 100000.0);
mat4 viewMatrix = lookAt(camPos, camPos + camForward, camUp);
mat4 viewProjectionMatrix = projectionMatrix * viewMatrix;
mat4 invViewProjectionMatrix = inverse(viewProjectionMatrix);

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
    glViewport(0, 0, width, height);
    framebufferSizeChanged = true;
    pxwidth = width;
    pxheight = height;
    projectionMatrix = perspective(radians(90.0), double(pxwidth ) / double(pxheight), 0.1, 100000.0);
    viewProjectionMatrix = viewMatrix * projectionMatrix;
    invViewProjectionMatrix = inverse(viewProjectionMatrix);
}

dvec2 mousePos;
static void cursor_position_callback(GLFWwindow* window, double xpos, double ypos)
{
    mousePos = dvec2(xpos, double(pxheight) - ypos);
}

bool shouldReset = true; // first frame reset
bool paused = false;
int queuedSteps = 0;
void key_callback(GLFWwindow* window, int key, int scancode, int action, int mods)
{
    if (key == GLFW_KEY_SPACE && action == GLFW_PRESS){
        shouldReset = true;
    }
    if (key == GLFW_KEY_P && action == GLFW_PRESS){
        paused = !paused;
    }
    if (key == GLFW_KEY_RIGHT && action == GLFW_PRESS){
        queuedSteps++;
    }
}

float camPitch = 0.0;
float camYaw = 0.0;

float speed = 10.0;
double sens = 5.0;

double lastInput = 0.0;
void processInput(GLFWwindow* window) {
    double t = glfwGetTime();
    double dt = t - lastInput;
    lastInput = t;
    dvec2 dm = ((mousePos - lastMouse) / dvec2(pxwidth, pxheight)) * sens;

    if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_RIGHT) == GLFW_RELEASE) 
        dm = dvec2(0);

    lastMouse = mousePos;

    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
        camPos += camForward * speed * float(dt);
    }
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
        camPos -= camRight * speed * float(dt);
    }
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
        camPos -= camForward * speed * float(dt);
    }
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
        camPos += camRight * speed * float(dt);
    }

    camPitch = float(clamp(double(camPitch) + dm.y, -PI / 2.01, PI / 2.01));
    camYaw = float(mod(double(camYaw) + dm.x, PI * 2.0));

    camForward = normalize(vec3(cos(camPitch) * sin(camYaw), cos(camPitch) * cos(camYaw), sin(camPitch)));
    camRight = normalize(cross(camForward, vec3(0,0,1)));
    camUp = normalize(cross(camRight, camForward));

    viewMatrix = lookAt(vec3(0), camForward, camUp);
    viewProjectionMatrix = projectionMatrix * viewMatrix;
    invViewProjectionMatrix = inverse(viewProjectionMatrix);

}

typedef struct TerrainGenTrackedInfo {
    vec4 averageFlow;
    float debug;
    float recentNetDeposition;
    float netDeposition;
    float averageWater;
}TerrainGenTrackedInfo;
typedef struct TerrainGenTileInfo {
    uvec4 ground;
    uvec4 fluid;
    uvec4 prevFluid;
    vec4 percentOut;
    vec2 velocity;

    //TerrainGenTrackedInfo tracked;
}TerrainGenTileInfo;

const int LOGMAPSIZE = 10;
const int MAPSIZE = (1 << LOGMAPSIZE);

int main(int, char**){
    
    //return 0;
    printf("Hello, from helloworld!\n");

    if(!glfwInit())
    {
        printf("GLFW Init failed\n");
        return 1;
    }
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

    glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, true);
    vec2 vertexPositions[] =
    {
        vec2(-1,-1),
        vec2(1,-1),
        vec2(0,1)
    };

    GLFWwindow* window = glfwCreateWindow(pxwidth,pxheight,"hello triangle", nullptr, nullptr);
    if(window == nullptr)
    {
        printf("failed to create glfw window\n");
        glfwTerminate();
        return -1;
    }

    glfwMakeContextCurrent(window);
    glfwSetCursorPosCallback(window, cursor_position_callback);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetKeyCallback(window, key_callback);

    gladLoadGL();

    glEnable              ( GL_DEBUG_OUTPUT );
    glDebugMessageCallback( MessageCallback, nullptr );
    
    ShaderProgram visProgram2D(
        "./resources/shaders/fullscreenTri.vert", 
        "./resources/shaders/2dheightmapvis.frag"
    );
    visProgram2D.setName("2D Shaded");

    ShaderProgram visProgram3D(
        "./resources/shaders/fullscreenTri.vert", 
        "./resources/shaders/erosionMapRaymarcher.frag"
    );
    visProgram3D.setName("3D Raymarched");

    ShaderProgram* activeVisProgram = &visProgram2D;

    glViewport(0,0,pxwidth,pxheight);

    GLuint vertexPositionBuffer;
    GLuint terrainDataSSBO;

    glCreateBuffers(1, &vertexPositionBuffer);
    glNamedBufferStorage(vertexPositionBuffer, sizeof(vertexPositions), vertexPositions, GL_DYNAMIC_STORAGE_BIT);

    const int TOTALMAPBYTES = 2 * MAPSIZE * MAPSIZE * sizeof(TerrainGenTileInfo);
    glCreateBuffers(1, &terrainDataSSBO);
    glNamedBufferStorage(terrainDataSSBO, TOTALMAPBYTES, NULL,  GL_MAP_READ_BIT);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 2, terrainDataSSBO);

    const char* initSource = "C:/Users/hartley/projects/layeredTerrain/resources/shaders/initializeHeightmap.comp";
    ShaderProgram initializeHeightmapComputeProgram(initSource);

    const char* waterOutSource = "C:/Users/hartley/projects/layeredTerrain/resources/shaders/calcWaterOutHeightmap.comp";
    ShaderProgram calcWaterOutHeightmapComputeProgram(waterOutSource);

    const char* erodeSource = "C:/Users/hartley/projects/layeredTerrain/resources/shaders/erodeHeightmap.comp";
    ShaderProgram erodeHeightmapComputeProgram(erodeSource);


    visProgram2D.use();
    GLuint VAO;

    glCreateVertexArrays(1,&VAO);

    GLuint vaoPositionBindingPoint = 0;

    GLuint attribPos = 0;

    glEnableVertexArrayAttrib(VAO,attribPos);

    glVertexArrayAttribBinding(VAO,attribPos,vaoPositionBindingPoint);

    glVertexArrayAttribFormat(VAO,attribPos, 2, GL_FLOAT, false, 0);

    glVertexArrayVertexBuffer(
            VAO,
            vaoPositionBindingPoint,
            vertexPositionBuffer,
            0,
            2 * sizeof(float)
    );

    glEnableVertexAttribArray(0);

    activeVisProgram->use();

    GLuint frogTex = loadImageGL("D:/OpenGLProject/resources/textures/original_square.bmp", GL_RGB8);
    glBindTextureUnit(0, frogTex);

    unsigned int uFrames = 1;

    double mousex = 1;
    double mousey = 0;

    glfwSetTime(0);
    int numFrames = 0;
    double lastTime = 0.0;

    const int ITERATIONSPERFRAME = 1;
    int heightmapErosionIterations = 0;
    glfwSwapInterval(1);

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    (void)io;
    ImGui::StyleColorsDark();
    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init("#version 460");

    while(!glfwWindowShouldClose(window))
    {
        glfwGetCursorPos(window, &mousex, &mousey);
        float lmb = glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_LEFT) == GLFW_PRESS ? 1.0 : 0.0;
        float rmb = glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_RIGHT) == GLFW_PRESS ? 1.0 : 0.0;

        if (shouldReset) {
            shouldReset = false;
            initializeHeightmapComputeProgram.checkRecompile();
            initializeHeightmapComputeProgram.use();
            glDispatchCompute(MAPSIZE / 8, MAPSIZE / 8, 1);
        }

        if (!paused || queuedSteps) {
            int iterations = paused ? queuedSteps : ITERATIONSPERFRAME;
            queuedSteps = 0;
            for(int i = 0; i < iterations; i++) {

                calcWaterOutHeightmapComputeProgram.checkRecompile();
                erodeHeightmapComputeProgram.checkRecompile();
                calcWaterOutHeightmapComputeProgram.use();
                glUniform1ui(glGetUniformLocation(calcWaterOutHeightmapComputeProgram.handle, "uFrames"), heightmapErosionIterations);
                glMemoryBarrier( GL_SHADER_STORAGE_BARRIER_BIT);
                glDispatchCompute(MAPSIZE / 8, MAPSIZE / 8, 1);

                erodeHeightmapComputeProgram.use();
                glUniform4f(glGetUniformLocation(erodeHeightmapComputeProgram.handle, "uMouse"), (float)mousex, (float)(pxheight - mousey), lmb, rmb);
                glUniform1ui(glGetUniformLocation(erodeHeightmapComputeProgram.handle, "uFrames"), heightmapErosionIterations);

                glMemoryBarrier( GL_SHADER_STORAGE_BARRIER_BIT);
                glDispatchCompute(MAPSIZE / 8, MAPSIZE / 8, 1);
                heightmapErosionIterations++;
            }
        }

        processInput(window);

        glClearColor(0.07f, 0.13f, 0.17f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);

        // Visualize Erosion
        if (activeVisProgram) {
            activeVisProgram->checkRecompile();
            activeVisProgram->use();

            glBindVertexArray(VAO);
            glUniform1i(glGetUniformLocation(activeVisProgram->handle, "frogTex"), 0);
            glUniform3f(glGetUniformLocation(activeVisProgram->handle, "uCameraPos"), (float)camPos.x, (float)camPos.y, (float)camPos.z);
            glUniform4f(glGetUniformLocation(activeVisProgram->handle, "uMouse"), (float)mousex, (float)(pxheight - mousey), lmb, rmb);
            glUniformMatrix4fv(glGetUniformLocation(activeVisProgram->handle, "uInvViewProjMatrix"), 1, GL_FALSE, &invViewProjectionMatrix[0][0]);
            glUniform1ui(glGetUniformLocation(activeVisProgram->handle, "uFrames"), uFrames);
            glUniform2f(glGetUniformLocation(activeVisProgram->handle, "uRes"), (float)pxwidth, (float)pxheight);

            glDrawArrays(GL_TRIANGLES, 0, 3);
        }

        // Record and draw UI
        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();

        ImGui::Begin("Options");
        ImGui::Text("Choose a visualization shader");

        if (ImGui::BeginCombo("##pick a visualization method", activeVisProgram ? activeVisProgram->programName.c_str() : "None")) {
            bool isSelected;
            
            // 2D
            isSelected = activeVisProgram == &visProgram2D;
            if (ImGui::Selectable(visProgram2D.programName.c_str(), &isSelected)) {
                activeVisProgram = &visProgram2D;
            }
            if (isSelected) {
                ImGui::SetItemDefaultFocus();
            }

            // 3D
            isSelected = activeVisProgram == &visProgram3D;
            if (ImGui::Selectable(visProgram3D.programName.c_str(), &isSelected)) {
                activeVisProgram = &visProgram3D;
            }
            if (isSelected) {
                ImGui::SetItemDefaultFocus();
            }

            // None
            isSelected = activeVisProgram == nullptr;
            if (ImGui::Selectable("None", &isSelected)) {
                activeVisProgram = nullptr;
            }
            if (isSelected) {
                ImGui::SetItemDefaultFocus();
            }

            ImGui::EndCombo();
        }

        ImGui::End();
        ImGui::Render();
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());

        GLenum err;
        while((err = glGetError()) != GL_NO_ERROR)
        {
            std::cout << "OGL ERROR IN MAIN LOOP: " << err << std::endl;
        }

        uFrames++;
        
        //printf("%i\n",uFrames);
        glfwSwapBuffers(window);
        glfwPollEvents();
        double currentTime = glfwGetTime();

        numFrames++;
        
        if (currentTime - lastTime >= 1.0) {
            printf("%i fps at %i by %i with map size of %i square\n", numFrames,pxwidth, pxheight,MAPSIZE);
            lastTime = currentTime;
            numFrames = 0;
        }

    }

    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();

    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;

}
