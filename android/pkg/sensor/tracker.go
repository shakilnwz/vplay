package sensor

import (
	"math"
	"sync"

	"github.com/shakilnwz/vplay/android/pkg/render"
)

// Quaternion represents a 4D unit orientation quaternion [x, y, z, w].
type Quaternion struct {
	X, Y, Z, W float32
}

// IdentityQuaternion returns an unrotated identity quaternion.
func IdentityQuaternion() Quaternion {
	return Quaternion{X: 0, Y: 0, Z: 0, W: 1}
}

// Inverse returns the conjugate of a unit quaternion.
func (q Quaternion) Inverse() Quaternion {
	return Quaternion{X: -q.X, Y: -q.Y, Z: -q.Z, W: q.W}
}

// Multiply computes the Hamilton product q * r.
func (q Quaternion) Multiply(r Quaternion) Quaternion {
	return Quaternion{
		W: q.W*r.W - q.X*r.X - q.Y*r.Y - q.Z*r.Z,
		X: q.W*r.X + q.X*r.W + q.Y*r.Z - q.Z*r.Y,
		Y: q.W*r.Y - q.X*r.Z + q.Y*r.W + q.Z*r.X,
		Z: q.W*r.Z + q.X*r.Y - q.Y*r.X + q.Z*r.W,
	}
}

// ToRotationMatrix converts a unit quaternion into an OpenGL column-major 4x4 matrix.
func (q Quaternion) ToRotationMatrix() render.Mat4 {
	x2 := q.X + q.X
	y2 := q.Y + q.Y
	z2 := q.Z + q.Z
	xx := q.X * x2
	xy := q.X * y2
	xz := q.X * z2
	yy := q.Y * y2
	yz := q.Y * z2
	zz := q.Z * z2
	wx := q.W * x2
	wy := q.W * y2
	wz := q.W * z2

	return render.Mat4{
		1.0 - (yy + zz), xy + wz, xz - wy, 0.0,
		xy - wz, 1.0 - (xx + zz), yz + wx, 0.0,
		xz + wy, yz - wx, 1.0 - (xx + yy), 0.0,
		0.0, 0.0, 0.0, 1.0,
	}
}

// Tracker manages sensor fusion orientation, smoothing, and reference re-centering.
type Tracker struct {
	mu           sync.RWMutex
	currentRot   Quaternion
	referenceRot Quaternion // Inverted calibration offset
	smoothedRot  Quaternion
	filterFactor float32 // Slerp damping factor (e.g. 0.2 for 100Hz sensor ticks)
}

// NewTracker creates an initialized motion tracker.
func NewTracker() *Tracker {
	return &Tracker{
		currentRot:   IdentityQuaternion(),
		referenceRot: IdentityQuaternion(),
		smoothedRot:  IdentityQuaternion(),
		filterFactor: 0.25,
	}
}

// UpdateRawSensor feeds raw fused rotation vector values from NDK ASensorManager.
func (t *Tracker) UpdateRawSensor(x, y, z, w float32) {
	t.mu.Lock()
	defer t.mu.Unlock()

	// Normalize quaternion
	lenSq := x*x + y*y + z*z + w*w
	if lenSq > 0.00001 {
		invLen := float32(1.0 / math.Sqrt(float64(lenSq)))
		t.currentRot = Quaternion{X: x * invLen, Y: y * invLen, Z: z * invLen, W: w * invLen}
	}

	// Smoothly interpolate toward target to eliminate gyro jitter
	t.smoothedRot = Slerp(t.smoothedRot, t.currentRot, t.filterFactor)
}

// Recenter calibrates current orientation as the new forward heading (0,0,-1).
func (t *Tracker) Recenter() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.referenceRot = t.currentRot.Inverse()
}

// GetOrientationMatrix returns the calibrated 4x4 camera rotation matrix.
func (t *Tracker) GetOrientationMatrix() render.Mat4 {
	t.mu.RLock()
	defer t.mu.RUnlock()

	// Calibrated orientation: reference * current
	calibrated := t.referenceRot.Multiply(t.smoothedRot)
	return calibrated.ToRotationMatrix()
}

// Slerp calculates spherical linear interpolation between two quaternions.
func Slerp(q1, q2 Quaternion, t float32) Quaternion {
	cosHalfTheta := q1.W*q2.W + q1.X*q2.X + q1.Y*q2.Y + q1.Z*q2.Z

	if cosHalfTheta < 0.0 {
		q2 = Quaternion{X: -q2.X, Y: -q2.Y, Z: -q2.Z, W: -q2.W}
		cosHalfTheta = -cosHalfTheta
	}

	if math.Abs(float64(cosHalfTheta)) >= 1.0 {
		return q1
	}

	halfTheta := float32(math.Acos(float64(cosHalfTheta)))
	sinHalfTheta := float32(math.Sqrt(float64(1.0 - cosHalfTheta*cosHalfTheta)))

	if math.Abs(float64(sinHalfTheta)) < 0.001 {
		return Quaternion{
			X: q1.X*0.5 + q2.X*0.5,
			Y: q1.Y*0.5 + q2.Y*0.5,
			Z: q1.Z*0.5 + q2.Z*0.5,
			W: q1.W*0.5 + q2.W*0.5,
		}
	}

	ratioA := float32(math.Sin(float64((1-t)*halfTheta))) / sinHalfTheta
	ratioB := float32(math.Sin(float64(t*halfTheta))) / sinHalfTheta

	return Quaternion{
		X: q1.X*ratioA + q2.X*ratioB,
		Y: q1.Y*ratioA + q2.Y*ratioB,
		Z: q1.Z*ratioA + q2.Z*ratioB,
		W: q1.W*ratioA + q2.W*ratioB,
	}
}
