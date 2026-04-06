#!/bin/sh

# repo="~/backend/web-application"

# add folder if not exist
folder_name="log_files"
directory="$(pwd)/$folder_name"
if [ ! -d "$directory" ]; then
  mkdir -p "$directory"
  echo "Directory '$directory' created."
else
  echo "Directory '$directory' already exists."
fi

# mysql logs
folder_name="mysql"
directory="$(pwd)/log_files/$folder_name"
if [ ! -d "$directory" ]; then
  mkdir -p "$directory"
  echo "Directory '$directory' created."
else
  echo "Directory '$directory' already exists."
fi



echo ""
echo "Getting latest for" ${repo} "repositories using pull"

echo "$ENV"
echo "****** Getting latest for" ${repo} "******"
# cd "${repo}"
# git pull
# sudo docker-compose down
if [ "$ENV" = "production" ]; then
    # sudo docker-compose down
    DOCKER_BUILDKIT=0 sudo docker compose build
    sudo docker compose up -d
else
    sudo docker compose -p "$ENV" -f docker-compose-"$ENV".yml down
    DOCKER_BUILDKIT=0 sudo docker compose -f docker-compose-"$ENV".yml build --no-cache
    sudo docker compose -p "$ENV" -f docker-compose-"$ENV".yml up -d
fi


echo "--------------------------------------"
echo " *** Removing Dangling Images *** "
sudo docker system prune -f
echo " *** Removed Dangling Images *** "
echo "--------------------------------------"


echo "Deployed ${ENV} environment Succesfully"
echo "******************************************"
