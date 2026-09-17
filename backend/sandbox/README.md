# Sandbox: manual CV pipeline scripts

Developer tools for running the face-analysis pipeline by hand. **Not part of
the test suite** (`pytest.ini` collects only `tests/`) and **not shipped**
(`.dockerignore` excludes this folder).

| File | Purpose |
|---|---|
| `run_pipeline.py` | Run the full pipeline on one image: `python sandbox/run_pipeline.py path/to/face.jpg` |
| `test_analyzers.py` | Check each analyzer on synthetic image patches: `python sandbox/test_analyzers.py [name]` |
| `_e2e_scan.py` | End-to-end upload → status → result against a running local server |
| `ml_pipeline.ipynb` | Notebook walk-through of the pipeline stages |
| `*.jpg` | Sample face images used by the scripts above |

Run from `backend/` so that `app.*` imports resolve. Needs the CV stack
(`mediapipe`, `opencv`, `scikit-image`) installed from `requirements.txt`.

> Before the repository is shared outside the team, confirm where the sample
> face images came from and that you have permission to use them, or replace
> them with licensed or synthetic images. Face photos are personal data.
