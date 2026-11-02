//go:build !android

package render

// GLEngine handles OpenGL rendering of VR meshes and video textures.
type GLEngine struct {
	ExternalTexID uint32
	sphereMesh    *Mesh
	domeMesh      *Mesh
	planeMesh     *Mesh
}

// NewGLEngine creates a render engine instance.
func NewGLEngine() *GLEngine {
	return &GLEngine{
		sphereMesh: GenerateSphere(50.0, 32, 64),
		domeMesh:   GenerateDome(50.0, 32, 64),
		planeMesh:  GeneratePlane(16.0 / 9.0),
	}
}

// InitGL prepares shader programs, buffers, and texture handles.
func (e *GLEngine) InitGL(vertSrc, fragSrc string) error {
	// Mock external texture ID for desktop testing
	e.ExternalTexID = 101
	return nil
}

// Render draws the specified projection mesh with current stereoscopic parameters.
func (e *GLEngine) Render(viewMode, stereoMode string, invertStereo bool, mvp Mat4) {
	// No-op for desktop mock
}

// Release frees GPU resources.
func (e *GLEngine) Release() {
}
