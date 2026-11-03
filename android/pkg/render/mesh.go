package render

import (
	"math"
)

// Vertex represents a 3D vertex with position and texture coordinates.
type Vertex struct {
	Pos [3]float32
	UV  [2]float32
}

// Mesh holds interleaved vertex data and triangle indices.
type Mesh struct {
	Vertices []float32 // [x, y, z, u, v, ...]
	Indices  []uint16
}

// GenerateSphere creates an inward-facing 360 equirectangular sphere mesh.
// radius: sphere radius (typically 1.0 or 10.0)
// rings: latitude divisions (e.g. 32)
// sectors: longitude divisions (e.g. 64)
func GenerateSphere(radius float32, rings, sectors int) *Mesh {
	mesh := &Mesh{}
	R := float64(radius)

	for r := 0; r <= rings; r++ {
		theta := float64(r) * math.Pi / float64(rings) // 0 to PI
		sinTheta := math.Sin(theta)
		cosTheta := math.Cos(theta)
		v := float32(1.0 - float64(r)/float64(rings))

		for s := 0; s <= sectors; s++ {
			phi := float64(s) * 2.0 * math.Pi / float64(sectors) // 0 to 2*PI
			sinPhi := math.Sin(phi)
			cosPhi := math.Cos(phi)
			u := float32(float64(s) / float64(sectors))

			// Inward normals: invert X so we view from the sphere center
			x := float32(-R * sinTheta * sinPhi)
			y := float32(R * cosTheta)
			z := float32(R * sinTheta * cosPhi)

			// Interleaved: Pos (x, y, z) + UV (u, v)
			mesh.Vertices = append(mesh.Vertices, x, y, z, u, v)
		}
	}

	for r := 0; r < rings; r++ {
		for s := 0; s < sectors; s++ {
			first := uint16(r*(sectors+1) + s)
			second := uint16((r+1)*(sectors+1) + s)

			// Two triangles per quad
			mesh.Indices = append(mesh.Indices, first, second, first+1)
			mesh.Indices = append(mesh.Indices, second, second+1, first+1)
		}
	}

	return mesh
}

// GenerateDome creates an inward-facing 180 hemisphere mesh for VR180 videos.
func GenerateDome(radius float32, rings, sectors int) *Mesh {
	mesh := &Mesh{}
	R := float64(radius)

	for r := 0; r <= rings; r++ {
		theta := float64(r) * math.Pi / float64(rings)
		sinTheta := math.Sin(theta)
		cosTheta := math.Cos(theta)
		v := float32(1.0 - float64(r)/float64(rings))

		for s := 0; s <= sectors; s++ {
			// Front hemisphere: phi from -PI/2 to PI/2
			phi := -math.Pi/2.0 + float64(s)*math.Pi/float64(sectors)
			sinPhi := math.Sin(phi)
			cosPhi := math.Cos(phi)
			u := float32(float64(s) / float64(sectors))

			x := float32(-R * sinTheta * sinPhi)
			y := float32(R * cosTheta)
			z := float32(R * sinTheta * cosPhi)

			mesh.Vertices = append(mesh.Vertices, x, y, z, u, v)
		}
	}

	for r := 0; r < rings; r++ {
		for s := 0; s < sectors; s++ {
			first := uint16(r*(sectors+1) + s)
			second := uint16((r+1)*(sectors+1) + s)

			mesh.Indices = append(mesh.Indices, first, second, first+1)
			mesh.Indices = append(mesh.Indices, second, second+1, first+1)
		}
	}

	return mesh
}

// GenerateCurvedCinema creates an inward-facing curved cylinder mesh (120-degree arc).
func GenerateCurvedCinema(radius float32, rings, sectors int) *Mesh {
	mesh := &Mesh{}
	R := float64(radius)
	arcRad := 120.0 * math.Pi / 180.0
	height := float64(radius) * 0.6 // Cinematic height

	for r := 0; r <= rings; r++ {
		y := (float64(r)/float64(rings) - 0.5) * height
		v := float32(1.0 - float64(r)/float64(rings))

		for s := 0; s <= sectors; s++ {
			// Phi from -arcRad/2 to arcRad/2
			phi := -arcRad/2.0 + float64(s)*arcRad/float64(sectors)
			u := float32(float64(s) / float64(sectors))

			x := float32(-R * math.Sin(phi))
			z := float32(R * math.Cos(phi))

			mesh.Vertices = append(mesh.Vertices, x, float32(y), z, u, v)
		}
	}

	for r := 0; r < rings; r++ {
		for s := 0; s < sectors; s++ {
			first := uint16(r*(sectors+1) + s)
			second := uint16((r+1)*(sectors+1) + s)

			mesh.Indices = append(mesh.Indices, first, second, first+1)
			mesh.Indices = append(mesh.Indices, second, second+1, first+1)
		}
	}

	return mesh
}

// GeneratePlane creates a default 2D flat video plane with given aspect ratio.
func GeneratePlane(aspect float32) *Mesh {
	return GeneratePlaneWithAspect(aspect, 16.0/9.0, 75.0*math.Pi/180.0, "fit")
}

// GeneratePlaneWithAspect creates a flat 2D plane quad fitting the viewport according to aspect mode.
func GeneratePlaneWithAspect(videoAspect, screenAspect, fovRad float32, mode string) *Mesh {
	if videoAspect <= 0 {
		videoAspect = 16.0 / 9.0
	}
	if screenAspect <= 0 {
		screenAspect = 16.0 / 9.0
	}

	dist := float32(2.0)
	halfH := dist * float32(math.Tan(float64(fovRad)/2.0))
	halfW := halfH * screenAspect

	w := halfW
	h := halfH

	switch mode {
	case "stretch":
		w = halfW
		h = halfH
	case "crop":
		h = halfH
		w = h * videoAspect
		if w < halfW {
			w = halfW
			h = w / videoAspect
		}
	case "100":
		w = videoAspect / 2.0
		h = 0.5
	default: // "fit"
		h = halfH
		w = h * videoAspect
		if w > halfW {
			w = halfW
			h = w / videoAspect
		}
	}

	vertices := []float32{
		//  X,  Y,    Z,    U,    V
		-w,  h, -dist, 0.0, 1.0, // Top-left
		 w,  h, -dist, 1.0, 1.0, // Top-right
		 w, -h, -dist, 1.0, 0.0, // Bottom-right
		-w, -h, -dist, 0.0, 0.0, // Bottom-left
	}

	indices := []uint16{
		0, 1, 2,
		0, 2, 3,
	}

	return &Mesh{
		Vertices: vertices,
		Indices:  indices,
	}
}
