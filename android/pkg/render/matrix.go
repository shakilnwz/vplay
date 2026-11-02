package render

import (
	"math"
)

// Mat4 represents a 4x4 column-major matrix compatible with OpenGL ES shaders.
type Mat4 [16]float32

// Identity returns a 4x4 identity matrix.
func Identity() Mat4 {
	return Mat4{
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1,
	}
}

// Multiply computes a * b (column-major).
func Multiply(a, b Mat4) Mat4 {
	var result Mat4
	for col := 0; col < 4; col++ {
		for row := 0; row < 4; row++ {
			sum := float32(0)
			for i := 0; i < 4; i++ {
				sum += a[row+i*4] * b[i+col*4]
			}
			result[row+col*4] = sum
		}
	}
	return result
}

// Perspective generates a standard OpenGL perspective projection matrix.
// fovYRad: vertical field of view in radians.
// aspect: viewport width / height.
// near, far: clipping planes.
func Perspective(fovYRad, aspect, near, far float32) Mat4 {
	f := float32(1.0 / math.Tan(float64(fovYRad)/2.0))
	nf := 1.0 / (near - far)

	return Mat4{
		f / aspect, 0, 0, 0,
		0, f, 0, 0,
		0, 0, (far + near) * nf, -1,
		0, 0, (2.0 * far * near) * nf, 0,
	}
}

// RotationEuler produces a rotation matrix from yaw (Y), pitch (X), and roll (Z) in radians.
func RotationEuler(yaw, pitch, roll float32) Mat4 {
	cosY := float32(math.Cos(float64(yaw)))
	sinY := float32(math.Sin(float64(yaw)))
	cosP := float32(math.Cos(float64(pitch)))
	sinP := float32(math.Sin(float64(pitch)))
	cosR := float32(math.Cos(float64(roll)))
	sinR := float32(math.Sin(float64(roll)))

	return Mat4{
		cosY*cosR + sinY*sinP*sinR, cosP * sinR, -sinY*cosR + cosY*sinP*sinR, 0,
		-cosY*sinR + sinY*sinP*cosR, cosP * cosR, sinY*sinR + cosY*sinP*cosR, 0,
		sinY * cosP, -sinP, cosY * cosP, 0,
		0, 0, 0, 1,
	}
}
