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
				if eglCtx != nil {
					eglCtx.Release()
					eglCtx = nil
				}
				if glEngine != nil {
					glEngine.Release()
					glEngine = nil
				}
				currentView = 0
			} else {
				currentView = e.View
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
			if eglCtx == nil && currentView != 0 && size.X > 0 && size.Y > 0 {
				jvmPtr := app.JavaVM()
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
					mvp := render.Multiply(proj, rot)

					viewModeStr := string(state.ViewMode)
					if viewModeStr == "" {
						viewModeStr = "360"
					}
					stereoModeStr := string(state.StereoMode)
					if stereoModeStr == "" {
						stereoModeStr = "horizontal"
					}

					glEngine.Render(viewModeStr, stereoModeStr, state.InvertStereo, mvp)
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
