#include "shader.h"
#include <stdio.h>
#include <stdlib.h>
#include <string>
#include <vector>
#include <algorithm>

using namespace std;

std::string ShaderStageNames[3]{
"Vertex",
"Fragment",
"Compute"
};


std::string readFile(const std::string& source)
{
    FILE* ptr = fopen(source.c_str(), "r");
    if(ptr == NULL) {
       // printf("Failed to find file at: %s\n", source.c_str());
        return "";
    }
    fseek(ptr, 0L, SEEK_END);
    int size = ftell(ptr);
   // printf("\nThe size of the shader at \"%s\" is %i\n",source,size);
     //fseek(ptr, 0L, SEEK_SET);
    rewind(ptr);
    std::string buf = "";
    char c;
    while(fread(&c, sizeof(char),1,ptr))
    {
        buf.push_back(c);
    }

    fclose(ptr);
    //printf("Read file:\n%s\n",buf);
    //printf("File length is %i, compared to strlen which is %i\n",size,strlen(buf));
    return buf;
}

bool Shader::compileShaderWithErrors(std::string& errorLog)
{
    glCompileShader(handle);
    GLint isCompiled = 0;
    glGetShaderiv(handle, GL_COMPILE_STATUS, &isCompiled);
    if(isCompiled == GL_FALSE)
    {
        GLint maxLength = 0;
        glGetShaderiv(handle, GL_INFO_LOG_LENGTH, &maxLength);

        // The maxLength includes the NULL character
        errorLog.resize(maxLength);
        glGetShaderInfoLog(handle, maxLength, &maxLength, &errorLog[0]);

        return false;
    }

    return true;
}

// from https://stackoverflow.com/questions/8518743/get-directory-from-file-path-c
std::string dirnameOf(const std::string& fname)
{
    size_t pos = fname.find_last_of("\\/");
    return (std::string::npos == pos)
           ? ""
           : fname.substr(0, pos);
}

bool ShaderProgram::createShaderProgramFromFiles(GLuint& shaderProgram, std::string& errorLog)
{
    errorLog = "";

    bool success = true;

    for (int i = 0; i < 3; i++) {
        if (shaders[i].location.empty()) continue;
        std::string shaderString = readFile(shaders[i].location);

        if (shaderString.empty()){
            std::string baseFilename = shaders[i].location.substr(shaders[i].location.find_last_of("/\\") + 1);
            (errorLog += "failed to read source file ") += baseFilename;
            errorLog += "\n";
            return false;
        }
        if(!parseShader(shaderString, dirnameOf(shaders[i].location))) {
            errorLog += "Failed to parse shader\n";
            return false;
        }
        std::string  shaderErrors;
        shaders[i].handle = glCreateShader(shaders[i].shaderType);
        const char* cstrshader = shaderString.c_str();
        glShaderSource(shaders[i].handle, 1, &cstrshader, NULL);

        if (!shaders[i].compileShaderWithErrors(shaderErrors)){
            (errorLog += "\n") += ShaderStageNames[i];
            errorLog += " Shader \"";
            errorLog += shaders[i].name;
            errorLog += "\" Failed to Compile:\n";
            errorLog += shaderErrors;
            return false;
        }
    }

    shaderProgram = glCreateProgram();
    if (shaderProgram == 0) {
        printf("Error creating shader program, shader.c, line 80ish\n");
        success = false;
    }

    for(int i = 0; i < 3; i++) {
        if (shaders[i].location.empty()) continue;
        glAttachShader(shaderProgram, shaders[i].handle);
    }

    glLinkProgram(shaderProgram);

    GLint program_linked;
    glGetProgramiv(shaderProgram, GL_LINK_STATUS, &program_linked);

    int logLength = 100000;
    glGetProgramiv(shaderProgram, GL_INFO_LOG_LENGTH, &logLength);

    switch(logLength) {
        case GL_INVALID_VALUE:
            printf("ERROR: GL_INVALID_VALUE at glGetProgramiv\n");
            exit(-1);
        case GL_INVALID_ENUM:
            printf("ERROR: GL_INVALID_ENUM at glGetProgramiv\n");
            exit(-1);
        case GL_INVALID_OPERATION:
            printf("ERROR: GL_INVALID_OPERATION at glGetProgramiv\n");
            exit(-1);
    }
    errorLog.resize(logLength + errorLog.size());
    if (logLength > 1) {

        int actualLogLength;
        glGetProgramInfoLog(shaderProgram,logLength, &actualLogLength, &errorLog[errorLog.size() - 1 - logLength]);
        success = false;
        //printf("\n\n------SHADER PROGRAM INFO LOG------\n%s\n\n", &errorLog[0]);

    }
    for(int i = 0; i < 3; i++) {
        if (shaders[i].location.empty()) continue;
        glDeleteShader(shaders[i].handle);
    }
    return success;
}

bool ShaderProgram::parseShader(std::string& originalShaderString,  const std::string& originalLocation) {
    const int MAXINCLUDES = 32;
    const int MAXINCLUDELENGTH = 256;
    int numIncludes = 0;
    unsigned long long lastPos = 0;
    while(numIncludes < MAXINCLUDES) {
        unsigned long long first = originalShaderString.find( "#include \"", lastPos);
            if(first == std::string::npos) break;first += 10;
        numIncludes++;
        unsigned long long last = originalShaderString.find('\"', first);
            if(last + 1 == std::string::npos) return false;last -= 1;
        std::string path = originalShaderString.substr(first, (last-first) + 1);

        originalShaderString.replace(first - 10, path.length() + 11, path.length() + 11,' ');
        lastPos = first;
        std::string includedShaderString = readFile(path);
        std::string originalPath = path;
        if(includedShaderString.empty()) {
            path = (originalLocation + "/") += originalPath;
            includedShaderString = readFile(path);
        }
        if(includedShaderString.empty()) {
            path = ((originalLocation + "/") += originalPath) += ".glsl";
            includedShaderString = readFile(path);
        }
        if(includedShaderString.empty()) {
            path = originalPath + ".glsl";
            includedShaderString = readFile(path);
        }
        if(includedShaderString.empty()) {
            return false;
        }

        if (std::find(includePaths.begin(), includePaths.end(),path) == includePaths.end())
            includePaths.push_back(path);

        originalShaderString.insert(first, includedShaderString);
    }
    return true;
}

