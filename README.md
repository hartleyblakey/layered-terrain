# Hydraulic Erosion Based Terrain Generation

![screenshot of eroded gravel slope](screenshots/graveltable.png)

Terrain is made up of 3 layers, with decreasing hardness and increasing carraying capacity:
- rock
- gravel
- sand

Each layer erodes into the next, except sand which erodes into itself. For example, when water passes over rock the height of the rock decreases, and the water layer gains the corresponding amount of suspended gravel.

The carrying capacity of the water depends on its volume and its velocity. This results in material being eroded as water runs down slopes, and deposited when the water settles in basins. The carrying capacity is also different for the different material types.