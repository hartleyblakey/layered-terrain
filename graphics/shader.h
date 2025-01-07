#ifndef __SHADERH__
#define __SHADERH__
#include <glad/glad.h>
#include <iostream>
#include <string>
#include <filesystem>
#include <chrono>
#include <GLFW/glfw3.h>
#include <vector>

class Shader {
public:
    GLuint shaderType;
    GLuint handle;
    std::string location;
    std::string name;
    Shader() {
        shaderType = GL_INVALID_ENUM;
        handle = GL_INVALID_VALUE;
        location = "";
        name = "Uninitialized Shader";
    }


    bool compileShaderWithErrors(std::string& errorLog);
};

enum ShaderStageEnum {
    STAGE_VERTEX    = 0,
    STAGE_FRAGMENT  = 1,
    STAGE_COMPUTE   = 2,
};

extern std::string ShaderStageNames[3];

std::string readFile(const std::string& source);

bool parseShader(std::string& originalShaderString);

bool compileShaderWithErrors(GLuint shader, const char* shaderName, std::string& errorLog);




class ShaderProgram {
public:
    Shader shaders[3];
    std::string programName;
    GLuint handle{};
    std::vector<std::string> includePaths;
    std::filesystem::file_time_type lastCompiled;
    bool compiled{};
    int failedAttempts{};
    bool createShaderProgramFromFiles(GLuint& shaderProgram, std::string& errorLog);
    bool parseShader(std::string& originalShaderString, const std::string& originalLocation);
    bool compile(std::string& errorLog) {
        GLuint newHandle;

        bool success = createShaderProgramFromFiles(newHandle, errorLog);

        if (success) {
            if (compiled) glDeleteProgram(handle);
            handle = newHandle;
            lastCompiled = std::filesystem::file_time_type::clock::now();
            failedAttempts = 0;
        }
        else {
            failedAttempts++;
            if (failedAttempts > 5) {

            }
        }
        return success;
    }

    void recompile() {
        bool activeFilesChanged = false;
        for (auto & shader : shaders) {
            if (
                    !shader.location.empty() &&
                    std::filesystem::last_write_time(shader.location) > lastCompiled
                )
                activeFilesChanged = true;

        }
        for (const auto & includePath : includePaths) {
            if (
                    !includePath.empty() &&
                    std::filesystem::last_write_time(includePath) > lastCompiled
                    )
                activeFilesChanged = true;

        }
        if (activeFilesChanged) {
            std::string errorLog;
            bool didCompile = false;
            for (int i = 0; i < 5; i++) {
                didCompile = compile(errorLog);
                if (didCompile) printf("Finally compiled on attempt %i\n", i + 1);
                if (didCompile)
                    break;

            }

            if (!didCompile) {std::cout << errorLog << std::endl;lastCompiled = std::filesystem::file_time_type::clock::now();}
        }

    }

    void use() const {
        glUseProgram(handle);
    }



    ShaderProgram(const std::string& vertSource, const std::string& fragSource) {
        shaders[STAGE_FRAGMENT].location = fragSource;
        shaders[STAGE_VERTEX].location = vertSource;

        shaders[STAGE_FRAGMENT].shaderType = GL_FRAGMENT_SHADER;
        shaders[STAGE_VERTEX].shaderType = GL_VERTEX_SHADER;

        shaders[STAGE_FRAGMENT].name = fragSource.substr(fragSource.find_last_of("/\\") + 1);
        shaders[STAGE_VERTEX].name = vertSource.substr(vertSource.find_last_of("/\\") + 1);

        compiled = false;
        failedAttempts = 0;
        std::string errorLog;
        double before = glfwGetTime();
        compiled = compile(errorLog);
        double after = glfwGetTime();
        if (!compiled) {
            std::cout << errorLog << std::endl;
            exit(-1);
        }
        else {
            std::cout << "Compiled shaders " << shaders[STAGE_VERTEX].name << " + " << shaders[STAGE_FRAGMENT].name
                      << " in " << (after-before) * 1000.0 << " milliseconds\n";
        }
    }

    ShaderProgram(const std::string& compSource) {
        shaders[STAGE_COMPUTE].location = compSource;

        shaders[STAGE_COMPUTE].shaderType = GL_COMPUTE_SHADER;

        shaders[STAGE_COMPUTE].name = compSource.substr(compSource.find_last_of("/\\") + 1);

        compiled = false;
        failedAttempts = 0;
        std::string errorLog;
        double before = glfwGetTime();
        compiled = compile(errorLog);
        double after = glfwGetTime();

        if (!compiled) {
            std::cout << errorLog << std::endl;
            exit(-1);
        }
        else {
            std::cout << "Compiled shader " << shaders[STAGE_COMPUTE].name
            << " in " << (after-before) * 1000.0 << " milliseconds\n";
        }
    }


    ShaderProgram() = default;

};







#endif