//go:build !android

package render

import (
	"image"

	"gioui.org/op"
)

type EGLContext struct{}

func NewEGLContext(jvmPtr uintptr, viewPtr uintptr) (*EGLContext, error) {
	return &EGLContext{}, nil
}

func (c *EGLContext) MakeCurrent() bool { return true }
func (c *EGLContext) Clear(r, g, b, a float32) {}
func (c *EGLContext) SetViewport(w, h int) {}
func (c *EGLContext) RenderUI(ops *op.Ops, size image.Point) error { return nil }
func (c *EGLContext) EnsureSurface(jvmPtr uintptr, viewPtr uintptr) bool { return true }
func (c *EGLContext) SwapBuffers() bool { return true }
func (c *EGLContext) Release() {}
