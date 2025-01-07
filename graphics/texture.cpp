#include <texture.h>
#include <stb_image.h>


GLuint loadImageGL(const char* file, GLuint format)
{
    stbi_set_flip_vertically_on_load(true);
    GLuint tex;
    GLuint otherFormat;
    int x,y,n;
    if(format == GL_RGBA8){n = 4; otherFormat = GL_RGBA;}
    else if(format == GL_RGB8){n = 3; otherFormat = GL_RGB;}
    else if(format == GL_RG8){n = 2; otherFormat = GL_RG;}
    else if(format == GL_R8){n = 1; otherFormat = GL_RED;}
    else{printf("ERROR: Invalid texture format specified for %s\n",file);return 0;}
    int textureN;
    unsigned char *data = stbi_load(file, &x, &y, &textureN, n);
    if(!data){printf("ERROR: stb failed to load the image at %s\n",file);return 0;}

    glCreateTextures(GL_TEXTURE_2D, 1, &tex);
    glTextureParameteri(tex, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTextureParameteri(tex, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTextureParameteri(tex, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTextureParameteri(tex, GL_TEXTURE_WRAP_T, GL_REPEAT);



    glTextureStorage2D(tex, 1, format, x, y);
    glTextureSubImage2D(tex, 0, 0, 0, x, y, otherFormat, GL_UNSIGNED_BYTE, data);

    return tex;
}