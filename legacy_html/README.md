# herakoi-web

## Folder Tree structure 
```bash
.                               
├── herakoi_web_test            # Folder with the App using Hue, Brightness; 4 test, single file
├── herakoi_web_three_channels  # Folder with the App using Hue, Brightness and Saturation; has dockefiles
│   └── html
│       └── assets
└── test_imgs                   # test images to test the app
```

## Use Dev & Prod dockerfile

### Dev
It has automatic restart of the NGINX reverse proxy, and a volume mapping to serve modified files. 
```bash
# start
docker-compose -f dev.docker-compose.yml up --build -d # if wanted detached mode
# stop; Ctrl+C is enough, but if --build is needed in the future, launch
docker-compose -f dev.docker-compose.yml down
```

### Prod
It copies at build the files in the container `/usr/share/nginx/html` folder. 
```bash
# start
docker-compose -f prod.docker-compose.yml up --build -d # if wanted detached mode
# stop; Ctrl+C is enough, but if --build is needed in the future, launch
docker-compose -f prod.docker-compose.yml down
```