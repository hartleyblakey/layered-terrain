cmake_minimum_required(VERSION 3.26)


project(layeredterrain)

set(CMAKE_CXX_STANDARD 20)

include_directories(.)
include_directories(graphics)
include_directories(Libraries/include)


#find_package( glfw3 3.3 REQUIRED )
#asdsad
add_library(stb_image Libraries/include/stb_image.c Libraries/include/stb_image.h)
add_library(texture graphics/texture.cpp graphics/texture.h)
add_library(shader graphics/shader.cpp graphics/shader.h)


add_executable(layeredterrain

        glad.c
        main.cpp
        main.h
        Libraries/include/imgui/imgui.cpp
        Libraries/include/imgui/imgui_impl_glfw.cpp
        Libraries/include/imgui/imgui_impl_opengl3.cpp
        Libraries/include/imgui/imgui_draw.cpp
        Libraries/include/imgui/imgui_tables.cpp
        Libraries/include/imgui/imgui_widgets.cpp
)

target_link_libraries(layeredterrain ${CMAKE_SOURCE_DIR}/Libraries/lib/libglfw3.a)
target_link_libraries(layeredterrain shader)
target_link_libraries(layeredterrain texture)
target_link_libraries(layeredterrain stb_image)
