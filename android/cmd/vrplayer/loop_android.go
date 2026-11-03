//go:build android

package main

import (
	"image"
	"log"
	"math"
	"runtime"

	"gioui.org/app"
	"gioui.org/op"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
	"github.com/shakilnwz/vplay/android/pkg/render"
	"github.com/shakilnwz/vplay/android/pkg/sensor"
	"github.com/shakilnwz/vplay/android/pkg/shader"
	"github.com/shakilnwz/vplay/android/pkg/storage"
	"github.com/shakilnwz/vplay/android/pkg/ui"
	"github.com/shakilnwz/vplay/android/pkg/video"
)

func runEventLoop(w *app.Window, playerUI *ui.App, state *appstate.AppState, backendRef *video.Player, tracker *sensor.Tracker) error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	var ops op.Ops
	var eglCtx *render.EGLContext
	var glEngine *render.GLEngine
	var currentView uintptr
	var size image.Point

	for {
		switch e := w.Event().(type) {
		case app.AndroidViewEvent:
			if !e.Valid() {
				if state.IsPlaying && backendRef != nil && *backendRef != nil {
					_ = (*backendRef).Pause()
				}
				currentView = 0
				storage.SetAndroidView(0)
			} else {
				currentView = e.View
				storage.CheckAndRequestOnce(e.View)
				w.Invalidate()
			}

		case app.DestroyEvent:
			if eglCtx != nil {
				eglCtx.Release()
				eglCtx = nil
			}
			if glEngine != nil {
				glEngine.Release()
				glEngine = nil
			}
			return e.Err

		case app.FrameEvent:
			size = e.Size
			jvmPtr := app.JavaVM()

			if eglCtx == nil && currentView != 0 && size.X > 0 && size.Y > 0 {
				var err error
				eglCtx, err = render.NewEGLContext(jvmPtr, currentView)
				if err != nil {
					log.Printf("Failed to create EGL context: %v", err)
				} else {
					glEngine = render.NewGLEngine()
					err = glEngine.InitGL(shader.SBSVertShader, shader.SBSFragShader)
					if err != nil {
						log.Printf("Failed to initialize GLEngine: %v", err)
					} else {
						log.Printf("GLEngine initialized successfully. ExternalTexID: %d", glEngine.ExternalTexID)
						p, err := video.New(glEngine.ExternalTexID)
						if err != nil {
							log.Printf("Failed to create video player on TexID %d: %v", glEngine.ExternalTexID, err)
						} else {
							*backendRef = p
							log.Printf("Video backend bound to hardware decoder and SurfaceTexture")
							if state.CurrentVideo != nil {
								_ = p.OpenURI(state.CurrentVideo.URI)
								if state.Position > 0 {
									_ = p.Seek(state.Position)
								}
								if state.IsPlaying {
									_ = p.Play()
								}
							}
						}
					}
				}
			}

			// Validate and rebind native window surface if screen changed / minimized / maximized
			if eglCtx != nil && currentView != 0 {
				if !eglCtx.EnsureSurface(jvmPtr, currentView) {
					gtx := app.NewContext(&ops, e)
					playerUI.Layout(gtx)
					e.Frame(gtx.Ops)
					continue
				}
			}

			if eglCtx != nil && eglCtx.MakeCurrent() {
				eglCtx.SetViewport(size.X, size.Y)
				eglCtx.Clear(0.04, 0.05, 0.08, 1.0)

				bp := *backendRef
				if glEngine != nil && bp != nil && state.CurrentVideo != nil {
					_ = bp.UpdateTexImage()

					aspect := float32(size.X) / float32(size.Y)
					if aspect <= 0 {
						aspect = 16.0 / 9.0
					}
					fovRad := float32(float64(state.CameraFOV) * math.Pi / 180.0)
					proj := render.Perspective(fovRad, aspect, 0.1, 200.0)

					yaw := state.Yaw
					pitch := state.Pitch
					roll := float32(0.0)

					rot := render.RotationEuler(yaw, pitch, roll)

					viewModeStr := string(state.ViewMode)
					if viewModeStr == "" {
						viewModeStr = "360"
					}
					stereoModeStr := string(state.StereoMode)
					if stereoModeStr == "" {
						stereoModeStr = "horizontal"
					}

					if state.GyroEnabled && tracker != nil && (viewModeStr == "360" || viewModeStr == "180" || viewModeStr == "curved") {
						gyroMat := tracker.GetOrientationMatrix()
						rot = render.Multiply(rot, gyroMat)
					}
					mvp := render.Multiply(proj, rot)

					if viewModeStr == "flat" {
						vW, vH := bp.VideoDimensions()
						vAspect := float32(16.0 / 9.0)
						if vW > 0 && vH > 0 {
							vAspect = float32(vW) / float32(vH)
						}
						glEngine.UpdatePlaneMesh(vAspect, aspect, fovRad, string(state.AspectRatio))
					}

					stMatrix := bp.TextureTransform()
					glEngine.Render(viewModeStr, stereoModeStr, state.InvertStereo, mvp, stMatrix)
				}

				gtx := app.NewContext(&ops, e)
				playerUI.Layout(gtx)

				_ = eglCtx.RenderUI(gtx.Ops, size)
				eglCtx.SwapBuffers()

				e.Frame(gtx.Ops)

				if state.IsPlaying {
					w.Invalidate()
				}
			} else {
				gtx := app.NewContext(&ops, e)
				playerUI.Layout(gtx)
				e.Frame(gtx.Ops)
			}
		}
	}
}
